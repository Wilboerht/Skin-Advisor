import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";
import { UserRole } from "@/lib/permissions";
import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { validatePasswordStrength } from "@/lib/password";
import { signLocalSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";


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

        // 密码复杂度校验：与官网对齐（8-32位，必须同时含大写/小写/数字）
        const passwordCheck = validatePasswordStrength(body.password);
        if (!passwordCheck.valid) {
            return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
        }

        // 官网注册接口需要: phone, code, password, confirmPassword
        const registerPayload = {
            ...body,
            confirmPassword: body.password,
        };

        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

        const result = await callOfficialApi<OfficialApiResponse<{ user: { id: string; phone: string; nickname?: string; avatar?: string; email?: string } }>>({
            method: "POST",
            path: "/api/auth/register",
            body: registerPayload,
            cookies: allCookies,
            requireSignature: false,
            timeoutMs: 30000,
        });

        if (!result) {
            return NextResponse.json(
                { error: "注册失败：上游服务响应异常或签名无效" },
                { status: 502 }
            );
        }

        const responseData = result.data;

        if (!result.ok || !responseData.success) {
            return NextResponse.json(
                { error: responseData.error?.message || "注册失败" },
                { status: result.status || 400 }
            );
        }

        if (!responseData.data?.user) {
            return NextResponse.json(
                { error: "注册失败：上游响应格式异常" },
                { status: 502 }
            );
        }

        const userPayload = responseData.data.user;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            logger.warn(`[AUDIT] Phone collision detected (register): new user ${userPayload.id} conflicts with existing user ${existingByPhone.id}.`);
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

        mirrorOfficialCookies(result.officialResponse, response, "register");

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
        logger.error("Register Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
