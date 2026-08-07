import { NextRequest, NextResponse } from "next/server";
import { ssoVerifier, getAccessToken, upsertLocalUser, SSO_BASE_URL } from "@/lib/sso-auth";
import prisma from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { verifyCsrfToken } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { UserRole } from "@/lib/permissions";

export async function GET(req: NextRequest) {
    const ip = getClientIP(req);
    const limit = await rateLimit(`me-get-ip-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    const token = await getAccessToken(req);
    if (!token) {
        return NextResponse.json({ user: null });
    }

    const payload = await ssoVerifier.verify(token);
    if (!payload?.sub) {
        return NextResponse.json({ user: null });
    }

    const localUser = await upsertLocalUser(payload);

    return NextResponse.json({
        user: {
            id: payload.sub,
            phone: payload.phone || null,
            name: localUser?.name || payload.phone || "",
            avatar: null,
            role: localUser?.role || "user",
        },
    });
}

export async function PUT(req: NextRequest) {
    const ip = getClientIP(req);
    const limit = await rateLimit(`me-put-ip-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
    if (!limit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    // CSRF protection for the sub-project's own endpoint
    const csrfResult = await verifyCsrfToken(req);
    if (!csrfResult.valid) {
        return apiError(ErrorCode.FORBIDDEN, "会话校验未通过，请刷新页面后再试。", 403);
    }

    const token = await getAccessToken(req);
    if (!token) {
        return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);
    }

    const payload = await ssoVerifier.verify(token);
    if (!payload?.sub) {
        return apiError(ErrorCode.UNAUTHORIZED, "登录已过期，请重新登录", 401);
    }

    try {
        const body = await req.json();
        const officialBody: { nickname?: string; avatar?: string } = {};
        if (body.nickname !== undefined) {
            officialBody.nickname = body.nickname;
        } else if (body.name !== undefined) {
            officialBody.nickname = body.name;
        }
        if (body.avatar !== undefined) {
            officialBody.avatar = body.avatar;
        }

        const response = await fetch(`${SSO_BASE_URL}/api/user/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(officialBody),
        });

        if (response.status === 401 || response.status === 403) {
            return apiError(ErrorCode.UNAUTHORIZED, "登录已过期，请重新登录", 401);
        }

        const data = (await response.json()) as { success?: boolean; data?: { user?: { id: string; phone: string; nickname: string | null; avatar: string | null } }; error?: { message?: string } };
        if (!response.ok || !data.success || !data.data?.user) {
            return apiError(
                ErrorCode.UPSTREAM_ERROR,
                data.error?.message || "更新失败",
                response.status || 502
            );
        }

        const user = data.data.user;

        // Sync the updated profile back to the local DB
        await prisma.user.upsert({
            where: { id: user.id },
            update: {
                phoneNumber: user.phone,
                name: user.nickname || user.phone,
            },
            create: {
                id: user.id,
                phoneNumber: user.phone,
                password: null,
                name: user.nickname || user.phone,
                role: UserRole.USER,
                tokenVersion: 0,
            },
        });

        return apiSuccess({
            user: {
                id: user.id,
                phone: user.phone,
                name: user.nickname || user.phone,
                avatar: user.avatar,
                role: "user",
            },
        });
    } catch (err) {
        logger.error("[auth/me] PUT error:", err);
        return apiError(ErrorCode.INTERNAL_ERROR, "服务暂时不可用，请稍后再试。", 500);
    }
}
