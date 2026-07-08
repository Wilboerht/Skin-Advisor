import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";
import { UserRole } from "@/lib/permissions";
import { parseOfficialResponse, type OfficialApiResponse } from "@/lib/official-api";


export async function POST(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`register-ip-${ip}`, "login");
        if (!ipLimit.success) {
            return NextResponse.json(
                { error: "注册尝试过于频繁，请 15 分钟后再试" },
                { status: 429 }
            );
        }

        const body = await req.json();
        if (!body.phone || !body.code || !body.password) {
            return NextResponse.json({ error: "缺少必填项" }, { status: 400 });
        }

        // 密码复杂度校验：至少8位，包含字母和数字
        if (body.password.length < 8) {
            return NextResponse.json({ error: "密码长度至少为 8 位" }, { status: 400 });
        }
        if (!/[a-zA-Z]/.test(body.password) || !/[0-9]/.test(body.password)) {
            return NextResponse.json({ error: "密码需包含字母和数字" }, { status: 400 });
        }

        // 官网注册接口需要: phone, code, password, confirmPassword
        // 我们在这个 proxy 里包装一层
        const registerPayload = {
            ...body,
            // 后端帮它补齐两次密码验证
            confirmPassword: body.password || "",
        };

        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        
        // 增加超时间：防止官方服务器（demo子域）响应过慢导致注册挂起
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

        const officialResponse = await fetch(`${officialApiUrl}/api/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(registerPayload),
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        const parsed = await parseOfficialResponse<OfficialApiResponse<{ user: { id: string; phone: string; nickname?: string; avatar?: string; email?: string } }>>(officialResponse);

        if (!parsed) {
            return NextResponse.json(
                { error: "注册失败：上游服务响应异常或签名无效" },
                { status: 502 }
            );
        }

        const responseData = parsed.data;

        // 无论何种错误，透传给前端
        if (!officialResponse.ok || !responseData.success) {
            return NextResponse.json(
                { error: responseData.error?.message || "注册失败" },
                { status: officialResponse.status || 400 }
            );
        }

        if (!responseData.data?.user) {
            return NextResponse.json(
                { error: "注册失败：上游响应格式异常" },
                { status: 502 }
            );
        }

        // 获取并透传官网的 Cookie (含 Domain信息)
        const userPayload = responseData.data.user;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            console.warn(`[AUDIT] Phone collision detected (register): new user ${userPayload.id} (phone: ${userPayload.phone}) conflicts with existing user ${existingByPhone.id}. Merging old record.`);
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

        mirrorOfficialCookies(officialResponse, response, "register");

        return response;

    } catch (e) {
        console.error("Register Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
