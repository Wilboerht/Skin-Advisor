import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createTokenVerifier } from "@nihplod/sso-verify";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { verifyCsrfToken } from "@/lib/csrf";
import { logger } from "@/lib/logger";

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn";
const SSO_CLIENT_ID = process.env.NEXT_PUBLIC_SSO_CLIENT_ID!;
const ACCESS_TOKEN_COOKIE = "__Host-nihplod_sso_at";

const verifier = createTokenVerifier({
    introspectionEndpoint: `${SSO_BASE_URL}/api/oauth/introspect`,
    clientId: SSO_CLIENT_ID,
    audience: SSO_CLIENT_ID,
    issuer: SSO_BASE_URL,
});

interface OfficialProfileUser {
    id: string;
    phone: string;
    nickname: string | null;
    avatar: string | null;
    createdAt?: string;
    stats?: {
        orderCount: number;
        addressCount: number;
    };
}

async function getAccessToken(req: NextRequest): Promise<string | null> {
    // 1. Authorization header (API / BFF usage)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }

    // 2. SSO access_token cookie set by the SDK callback handler
    const cookieStore = await cookies();
    return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value || null;
}

async function upsertLocalUser(userId: string, phone: string, nickname?: string | null, avatar?: string | null) {
    try {
        return await prisma.user.upsert({
            where: { id: userId },
            update: {
                phoneNumber: phone,
                name: nickname || phone,
                avatarUrl: avatar || null,
            },
            create: {
                id: userId,
                phoneNumber: phone,
                password: "",
                name: nickname || phone,
                avatarUrl: avatar || null,
                role: "user",
                tokenVersion: 0,
            },
        });
    } catch (err) {
        logger.error("[auth/me] Failed to upsert local user:", err);
        return null;
    }
}

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

    const payload = await verifier.verify(token);
    if (!payload?.sub) {
        return NextResponse.json({ user: null });
    }

    // Sync local user record so that existing features (tests, campaigns) keep working
    const localUser = await upsertLocalUser(
        payload.sub,
        payload.phone || "",
        undefined,
        undefined
    );

    return NextResponse.json({
        user: {
            id: payload.sub,
            phone: payload.phone || null,
            name: localUser?.name || payload.phone || "",
            avatar: localUser?.avatarUrl || null,
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
    if (!verifyCsrfToken(req)) {
        return apiError(ErrorCode.FORBIDDEN, "安全验证失败，请刷新页面后重试", 403);
    }

    const token = await getAccessToken(req);
    if (!token) {
        return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);
    }

    const payload = await verifier.verify(token);
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

        const data = (await response.json()) as { success?: boolean; data?: { user?: OfficialProfileUser }; error?: { message?: string } };
        if (!response.ok || !data.success || !data.data?.user) {
            return apiError(
                ErrorCode.UPSTREAM_ERROR,
                data.error?.message || "更新失败",
                response.status || 502
            );
        }

        const user = data.data.user;

        // Sync the updated profile back to the local DB
        await upsertLocalUser(user.id, user.phone, user.nickname, user.avatar);

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
        return apiError(ErrorCode.INTERNAL_ERROR, "应用系统异常，请稍后重试", 500);
    }
}
