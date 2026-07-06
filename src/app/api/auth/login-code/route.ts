import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";

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
    try {
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`login-code-ip-${ip}`, "login");
        if (!ipLimit.success) {
            return NextResponse.json(
                { error: "登录尝试过于频繁，请 15 分钟后再试" },
                { status: 429 }
            );
        }

        const body = await req.json();
        if (!body.phone || !body.code) {
            return NextResponse.json(
                { error: "缺少手机号或验证码" },
                { status: 400 }
            );
        }

        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const officialResponse = await fetch(`${officialApiUrl}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ phone: body.phone, code: body.code }),
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
            return NextResponse.json(
                { error: responseData.error?.message || "登录失败" },
                { status: officialResponse.status || 401 }
            );
        }

        const userPayload = responseData.data.user;

        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            await prisma.user.update({
                where: { id: existingByPhone.id },
                data: { phoneNumber: `merged_${existingByPhone.id}_${userPayload.phone}` }
            });
        }

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
                role: "user"
            }
        });

        const response = NextResponse.json({
            user: {
                ...responseData.data.user,
                phone: responseData.data.user.phone,
                name: responseData.data.user.nickname || responseData.data.user.phone,
                role: "user"
            }
        });

        mirrorOfficialCookies(officialResponse, response, "login-code");

        return response;

    } catch (e) {
        console.error("LoginCode Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
