import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function mirrorOfficialSessionCookie(officialResponse: Response, response: NextResponse) {
    const setCookieHeader = officialResponse.headers.get("set-cookie");
    if (!setCookieHeader) return;

    const firstPair = setCookieHeader.split(";")[0];
    const [cookieName, cookieValue] = firstPair.split("=");
    if (!cookieName || !cookieValue) return;

    // Re-issue cookie on our domain so browsers accept it regardless of the official domain
    response.cookies.set(cookieName, cookieValue, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30 // 30 days
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        if (!body.phone || !body.password) {
            return NextResponse.json(
                { error: "缺少手机号或密码" },
                { status: 400 }
            );
        }

        // 代理到官网密码登录接口
        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        const officialResponse = await fetch(`${officialApiUrl}/api/auth/login-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body) // { phone, password }
        });

        const responseData = await officialResponse.json();

        if (!officialResponse.ok || !responseData.success) {
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
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
