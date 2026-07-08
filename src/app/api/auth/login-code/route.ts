import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";
import { UserRole } from "@/lib/permissions";
import { parseOfficialResponse, type OfficialApiResponse } from "@/lib/official-api";


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

        const parsed = await parseOfficialResponse<OfficialApiResponse<{ user: { id: string; phone: string; nickname?: string; avatar?: string; email?: string } }>>(officialResponse);

        if (!parsed) {
            return NextResponse.json(
                { error: "登录失败：上游服务响应异常或签名无效" },
                { status: 502 }
            );
        }

        const responseData = parsed.data;

        if (!officialResponse.ok || !responseData.success) {
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

        const userPayload = responseData.data.user;

        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            console.warn(`[AUDIT] Phone collision detected (login-code): new user ${userPayload.id} (phone: ${userPayload.phone}) conflicts with existing user ${existingByPhone.id}. Merging old record.`);
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
                role: UserRole.USER,
                tokenVersion: 0
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

        mirrorOfficialCookies(officialResponse, response, "login-code");

        return response;

    } catch (e) {
        console.error("LoginCode Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
