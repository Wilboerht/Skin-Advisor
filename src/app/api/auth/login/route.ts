import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { verifyPassword, signLocalSession } from "@/lib/auth";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";
import { UserRole } from "@/lib/permissions";

import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { cookies } from "next/headers";

async function tryDevLocalLogin(phone: string, password: string): Promise<NextResponse | null> {
    // 双重开关：仅允许非生产环境 + 显式设置 ALLOW_LOCAL_LOGIN=true
    if (process.env.NODE_ENV === "production" || process.env.ALLOW_LOCAL_LOGIN !== "true") return null;

    const localUser = await prisma.user.findUnique({
        where: { phoneNumber: phone }
    });
    if (!localUser || !localUser.password) return null;

    const passwordValid = await verifyPassword(password, localUser.password);
    if (!passwordValid) return null;

    const response = NextResponse.json({
        user: {
            id: localUser.id,
            phone: localUser.phoneNumber,
            name: localUser.name || localUser.phoneNumber,
            avatar: localUser.avatarUrl,
            role: localUser.role
        }
    });

    // 开发环境本地回退：使用非 Secure Cookie
    await signLocalSession(response, {
        id: localUser.id,
        email: localUser.email,
        phone: localUser.phoneNumber,
        name: localUser.name,
        role: localUser.role,
        tokenVersion: localUser.tokenVersion,
        dailyTestLimit: localUser.dailyTestLimit,
    }, { secure: false });

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
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

        // 子站暴露 /api/auth/login，映射到官网的 /api/auth/login-password
        const result = await callOfficialApi<OfficialApiResponse<{ user: { id: string; phone: string; nickname?: string; avatar?: string; email?: string } }>>({
            method: "POST",
            path: "/api/auth/login-password",
            body,
            cookies: allCookies,
            requireSignature: false,
            timeoutMs: 30000,
        });

        if (!result) {
            const devResponse = await tryDevLocalLogin(body.phone, body.password);
            if (devResponse) return devResponse;

            return NextResponse.json(
                { error: "登录失败：上游服务响应异常或签名无效" },
                { status: 502 }
            );
        }

        const responseData = result.data;

        if (!result.ok || !responseData.success) {
            const devResponse = await tryDevLocalLogin(body.phone, body.password);
            if (devResponse) return devResponse;

            return NextResponse.json(
                { error: responseData.error?.message || "登录失败" },
                { status: result.status || 401 }
            );
        }

        if (!responseData.data?.user) {
            return NextResponse.json(
                { error: "登录失败：上游响应格式异常" },
                { status: 502 }
            );
        }

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
        const localUser = await prisma.user.upsert({
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
                phone: userPayload.phone,
                name: userPayload.nickname || userPayload.phone,
                role: UserRole.USER
            }
        });

        mirrorOfficialCookies(result.officialResponse, response, "login");

        // 立即签发子站本地 session，避免首次访问 /api/auth/me 前本地 API 认为未登录
        await signLocalSession(response, {
            id: localUser.id,
            email: userPayload.email || null,
            phone: localUser.phoneNumber,
            name: localUser.name,
            role: localUser.role,
            tokenVersion: localUser.tokenVersion,
            dailyTestLimit: localUser.dailyTestLimit,
        });

        return response;

    } catch (e) {
        console.error("Login Proxy Error", e);

        // 开发环境：官方接口不可达时，尝试本地账号密码验证
        const devResponse = await tryDevLocalLogin(body.phone, body.password);
        if (devResponse) return devResponse;

        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
