import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { verifyPassword, signToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";
import { UserRole } from "@/lib/permissions";
import { generateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/csrf";
import { parseOfficialResponse, type OfficialApiResponse } from "@/lib/official-api";

async function tryDevLocalLogin(phone: string, password: string): Promise<NextResponse | null> {
    // 双重开关：仅允许非生产环境 + 显式设置 ALLOW_LOCAL_LOGIN=true
    if (process.env.NODE_ENV === "production" || process.env.ALLOW_LOCAL_LOGIN !== "true") return null;

    const localUser = await prisma.user.findUnique({
        where: { phoneNumber: phone }
    });
    if (!localUser || !localUser.password) return null;

    const passwordValid = await verifyPassword(password, localUser.password);
    if (!passwordValid) return null;

    const csrfToken = generateCsrfToken();
    const token = await signToken({
        sub: localUser.id,
        email: localUser.email,
        phone: localUser.phoneNumber,
        name: localUser.name,
        role: localUser.role,
        tokenVersion: localUser.tokenVersion,
        dailyTestLimit: localUser.dailyTestLimit,
        csrf: csrfToken,
    }, "7d");

    const response = NextResponse.json({
        user: {
            id: localUser.id,
            phone: localUser.phoneNumber,
            name: localUser.name || localUser.phoneNumber,
            avatar: localUser.avatarUrl,
            role: localUser.role
        }
    });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: false, // 仅开发环境本地登录使用
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60,
        path: "/"
    });
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
        httpOnly: false,
        secure: false,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60,
        path: "/"
    });
    return response;
}


export async function POST(req: NextRequest) {
    let body: { phone?: string; password?: string } = {};
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    if (!body.phone || !body.password) {
        return NextResponse.json(
            { error: "缺少手机号或密码" },
            { status: 400 }
        );
    }

    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`login-password-ip-${ip}`, "login");
    if (!ipLimit.success) {
        return NextResponse.json(
            { error: "登录尝试过于频繁，请 15 分钟后再试" },
            { status: 429 }
        );
    }

    try {
        // 代理到官网密码登录接口
        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        
        // 增加超时间：防止官方服务器（demo子域）响应过慢导致系统崩溃
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

        const officialResponse = await fetch(`${officialApiUrl}/api/auth/login-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        const parsed = await parseOfficialResponse<OfficialApiResponse<{ user: { id: string; phone: string; nickname?: string; avatar?: string; email?: string } }>>(officialResponse);

        if (!parsed) {
            return NextResponse.json(
                { error: "登录失败：上游服务响应异常或签名无效" },
                { status: 502 }
            );
        }

        const responseData = parsed.data;

        if (!officialResponse.ok || !responseData.success) {
            const devResponse = await tryDevLocalLogin(body.phone, body.password);
            if (devResponse) return devResponse;

            return NextResponse.json(
                { error: responseData.error?.message || "登录失败" },
                { status: officialResponse.status || 401 }
            );
        }

        if (!responseData.data?.user) {
            return NextResponse.json(
                { error: "登录失败：上游响应格式异常" },
                { status: 502 }
            );
        }

        // 获取并透传官网的 Cookie
        const userPayload = responseData.data.user;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            console.warn(`[AUDIT] Phone collision detected: new user ${userPayload.id} (phone: ${userPayload.phone}) conflicts with existing user ${existingByPhone.id}. Merging old record.`);
            await prisma.user.update({
                where: { id: existingByPhone.id },
                data: { phoneNumber: `merged_${existingByPhone.id}_${userPayload.phone}` }
            });
        }

        // Upsert user into local database
        await prisma.user.upsert({
            where: { id: userPayload.id },
            update: {
                phoneNumber: userPayload.phone,
                name: userPayload.nickname || userPayload.phone,
                avatarUrl: userPayload.avatar || null,
            },
            create: {
                id: userPayload.id,
                phoneNumber: userPayload.phone,
                password: "", // Local password isn't used
                name: userPayload.nickname || userPayload.phone,
                avatarUrl: userPayload.avatar || null,
                role: UserRole.USER
            }
        });

        const response = NextResponse.json({
            user: {
                ...userPayload,
                // 确保我们返回的字段名和原先系统要求的对齐
                phone: userPayload.phone,
                name: userPayload.nickname || userPayload.phone,
                role: UserRole.USER
            }
        });

        mirrorOfficialCookies(officialResponse, response, "login");

        return response;

    } catch (e) {
        console.error("Login Proxy Error", e);

        // 开发环境：官方接口不可达时，尝试本地账号密码验证
        const devResponse = await tryDevLocalLogin(body.phone, body.password);
        if (devResponse) return devResponse;

        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
