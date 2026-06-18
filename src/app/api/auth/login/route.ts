import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { verifyPassword, signToken } from "@/lib/auth";

async function tryDevLocalLogin(phone: string, password: string): Promise<NextResponse | null> {
    if (process.env.NODE_ENV === "production") return null;

    const localUser = await prisma.user.findUnique({
        where: { phoneNumber: phone }
    });
    if (!localUser || !localUser.password) return null;

    const passwordValid = await verifyPassword(password, localUser.password);
    if (!passwordValid) return null;

    const token = await signToken({
        sub: localUser.id,
        email: localUser.email,
        phone: localUser.phoneNumber,
        name: localUser.name,
        role: localUser.role,
        dailyTestLimit: localUser.dailyTestLimit
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
    response.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/"
    });
    return response;
}

function mirrorOfficialSessionCookie(officialResponse: Response, response: NextResponse) {
    const cookies = officialResponse.headers.getSetCookie();
    
    if (cookies.length === 0) {
        console.warn("⚠️  Official API did NOT return set-cookie header");
        return;
    }

    for (const cookieStr of cookies) {
        // Split by first '=' to get name and value+attributes
        const eqIdx = cookieStr.indexOf("=");
        if (eqIdx === -1) continue;
        
        const cookieName = cookieStr.substring(0, eqIdx).trim();
        const rest = cookieStr.substring(eqIdx + 1);
        
        // Get value (before first semicolon)
        const semiIdx = rest.indexOf(";");
        const cookieValue = (semiIdx === -1 ? rest : rest.substring(0, semiIdx)).trim();
        
        if (!cookieName || !cookieValue) {
            console.warn(`⚠️  Skipped invalid cookie pair: ${cookieName}=${cookieValue}`);
            continue;
        }

        // Cookie set successfully (debug log removed for production)
        response.cookies.set(cookieName, cookieValue, {
            httpOnly: true,
            sameSite: "strict",
            path: "/",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30 // 30 days
        });
    }
}


async function parseOfficialJson(officialResponse: Response) {
    const contentType = officialResponse.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const text = await officialResponse.text();
        console.error("Official API returned non-JSON response", text.slice(0, 300));
        return null;
    }
    try {
        return await officialResponse.json();
    } catch {
        const text = await officialResponse.text();
        console.error("Official API JSON parse failed", text.slice(0, 300));
        return null;
    }
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
    const ipLimit = await rateLimit(`login-ip-${ip}`, "login");
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

        const responseData = await parseOfficialJson(officialResponse);

        if (!responseData) {
            return NextResponse.json(
                { error: "登录失败：上游服务响应异常" },
                { status: 502 }
            );
        }

        if (!officialResponse.ok || !responseData.success) {
            const devResponse = await tryDevLocalLogin(body.phone, body.password);
            if (devResponse) return devResponse;

            return NextResponse.json(
                { error: responseData.error?.message || "登录失败" },
                { status: officialResponse.status || 401 }
            );
        }

        // 获取并透传官网的 Cookie
        const userPayload = responseData.data.user;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
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
                role: "user"
            }
        });

        const response = NextResponse.json({
            user: {
                ...responseData.data.user,
                // 确保我们返回的字段名和原先系统要求的对齐
                phone: responseData.data.user.phone,
                name: responseData.data.user.nickname || responseData.data.user.phone,
                role: "user"
            }
        });

        mirrorOfficialSessionCookie(officialResponse, response);

        return response;

    } catch (e) {
        console.error("Login Proxy Error", e);

        // 开发环境：官方接口不可达时，尝试本地账号密码验证
        const devResponse = await tryDevLocalLogin(body.phone, body.password);
        if (devResponse) return devResponse;

        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
