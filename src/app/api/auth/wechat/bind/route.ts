/**
 * 微信绑定手机号（子站）
 * POST /api/auth/wechat/bind
 *
 * 不再直接代理官网 /api/auth/wechat/bind（该接口依赖官网 host-only Cookie），
 * 改为调用官网内部 API /api/v1/internal/wechat/exchange，使用 URL 传递的
 * wechat_exchange_token 完成绑定与登录。
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { UserRole } from "@/lib/permissions";
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { parseOfficialResponse } from "@/lib/official-api";
import { signLocalSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

// 与官网 src/types/auth.ts 保持一致
const USER_COOKIE_NAME = "__Host-user_token";
const USER_REFRESH_COOKIE_NAME = "__Host-user_refresh_token";

const USER_ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 15 * 60,
};

const USER_REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
};

interface OfficialBindUser {
    id: string;
    phone: string;
    nickname?: string;
    avatar?: string;
    email?: string;
}

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`wechat-bind-ip-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!ipLimit.success) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
        }

        const body = await req.json();
        if (!body.wechatExchangeToken) {
            return NextResponse.json({ error: "缺少微信授权凭证" }, { status: 400 });
        }
        if (!body.phone || !body.code) {
            return NextResponse.json({ error: "缺少手机号或验证码" }, { status: 400 });
        }

        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        const path = "/api/v1/internal/wechat/exchange";
        const payload = {
            wechatExchangeToken: body.wechatExchangeToken,
            phone: body.phone,
            code: body.code,
            password: body.password,
            allowAutoPassword: body.allowAutoPassword ?? true,
        };
        const bodyText = JSON.stringify(payload);

        const signed = await createSignedInternalApiHeaders("advisor", "POST", path, bodyText);
        if (!signed) {
            return NextResponse.json({ error: "未配置内部 API 密钥" }, { status: 500 });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const officialResponse = await fetch(`${officialApiUrl}${path}`, {
            method: "POST",
            headers: signed.headers,
            body: bodyText,
            signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        const parsed = await parseOfficialResponse<{
            success: boolean;
            error?: { code: string; message: string };
            data?: {
                user?: OfficialBindUser;
                accessToken?: string;
                refreshToken?: string;
                message?: string;
                passwordGenerated?: boolean;
            };
        }>(officialResponse, { requireSignature: false });

        if (!parsed) {
            return NextResponse.json({ error: "官网响应签名校验失败或响应无效" }, { status: 502 });
        }

        const responseData = parsed.data;

        if (!officialResponse.ok || !responseData.success) {
            return NextResponse.json(
                { error: responseData.error?.message || "绑定失败" },
                { status: officialResponse.status || 400 }
            );
        }

        const result = responseData.data;
        if (!result?.user || !result.accessToken || !result.refreshToken) {
            return NextResponse.json(
                { error: "绑定失败：上游响应格式异常" },
                { status: 502 }
            );
        }

        const userPayload = result.user;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            logger.warn(`[AUDIT] Phone collision detected (wechat-bind): new user ${userPayload.id} conflicts with existing user ${existingByPhone.id}. Merging old record.`);
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
                name: userPayload.nickname || userPayload.phone,
                role: UserRole.USER
            },
            message: result.message,
            passwordGenerated: result.passwordGenerated,
        });

        // 设置官网同款登录 Cookie
        response.cookies.set(USER_COOKIE_NAME, result.accessToken, USER_ACCESS_COOKIE_OPTIONS);
        response.cookies.set(USER_REFRESH_COOKIE_NAME, result.refreshToken, USER_REFRESH_COOKIE_OPTIONS);

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
        logger.error("Bind Proxy Error", { error: String(e) });
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
