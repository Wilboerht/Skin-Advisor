import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { UserRole } from "@/lib/permissions";

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`wechat-bind-ip-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!ipLimit.success) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
        }

        const body = await req.json();

        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";

        // Pass the request holding the wechat_bind_token cookie
        const cookieHeader = req.headers.get("cookie") || "";

        const officialResponse = await fetch(`${officialApiUrl}/api/auth/wechat/bind`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": cookieHeader
            },
            body: JSON.stringify(body)
        });

        const responseData = await officialResponse.json();

        if (!officialResponse.ok || !responseData.success) {
            return NextResponse.json(
                { error: responseData.error?.message || "绑定失败" },
                { status: officialResponse.status || 400 }
            );
        }

        const setCookieHeader = officialResponse.headers.get("Set-Cookie");
        const userPayload = responseData.data.user;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            console.warn(`[AUDIT] Phone collision detected (wechat-bind): new user ${userPayload.id} (phone: ${userPayload.phone}) conflicts with existing user ${existingByPhone.id}. Merging old record.`);
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
                password: "",
                name: userPayload.nickname || userPayload.phone,
                avatarUrl: userPayload.avatar || null,
                role: UserRole.USER
            }
        });

        const response = NextResponse.json({
            user: {
                ...userPayload,
                name: userPayload.nickname || userPayload.phone,
                role: UserRole.USER
            }
        });

        if (setCookieHeader) {
            // Need to handle multiple Set-Cookie headers properly. fetch().headers returns multiple joined by comma, which is buggy for set-cookie.
            // But we typically only set USER_COOKIE_NAME and clear wechat_bind_token. 
            // In Next.js App router, we can iterate over the headers.
            const rawSetCookies = officialResponse.headers.getSetCookie();
            rawSetCookies.forEach(cookie => {
                response.headers.append('Set-Cookie', cookie);
            });
        }

        return response;

    } catch (e) {
        console.error("Bind Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
