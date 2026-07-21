import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getSession, signLocalSession } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";
import { createHash } from "crypto";
import { UserRole } from "@/lib/permissions";
import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { logger } from "@/lib/logger";

// 官网 /api/user/profile 返回的用户结构
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

// 简单的内存缓存，防止外部官方 API 慢导致每个请求都阻塞 10s+
const meCache = new Map<string, { data: unknown; timestamp: number }>();
const ME_CACHE_TTL_MS = 1000; // 1 秒缓存：在降低官方 API 压力与会话状态及时性之间取平衡
const MAX_CACHE_SIZE = 100;

function getCacheKey(cookieStr: string): string {
    return createHash('sha256').update(cookieStr).digest('hex');
}

function getMeCache(key: string): unknown | null {
    const entry = meCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ME_CACHE_TTL_MS) {
        meCache.delete(key);
        return null;
    }
    return entry.data;
}

function setMeCache(key: string, data: unknown) {
    if (meCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = meCache.keys().next().value as string | undefined;
        if (oldestKey) meCache.delete(oldestKey);
    }
    meCache.set(key, { data, timestamp: Date.now() });
}

async function getLocalSessionUser(): Promise<NextResponse | null> {
    try {
        const localUser = await getSession();
        if (!localUser) return null;

        const dbUser = await prisma.user.findUnique({
            where: { id: localUser.id },
            select: { id: true, phoneNumber: true, name: true, avatarUrl: true, role: true }
        });
        if (!dbUser) return null;

        return NextResponse.json({
            user: {
                id: dbUser.id,
                phone: dbUser.phoneNumber,
                name: dbUser.name || dbUser.phoneNumber,
                avatar: dbUser.avatarUrl,
                role: dbUser.role || "user"
            }
        });
    } catch (err) {
        logger.error("[auth/me] Local session lookup failed:", err);
        return null;
    }
}

export async function GET(req: NextRequest) {
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`me-get-ip-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!ipLimit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    if (!allCookies) {
        const localResponse = await getLocalSessionUser();
        return localResponse || NextResponse.json({ user: null });
    }

    try {
        const cacheKey = getCacheKey(allCookies);
        const cached = getMeCache(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        const result = await callOfficialApi<OfficialApiResponse<OfficialProfileUser>>({
            method: "GET",
            path: "/api/user/profile",
            cookies: allCookies,
            requireSignature: false,
            timeoutMs: 30000,
        });

        if (!result) {
            // 网络错误或签名校验失败：回退到本地 session
            const localResponse = await getLocalSessionUser();
            return localResponse || NextResponse.json({ user: null });
        }

        const data = result.data;

        // 官网明确返回 401/403：用户未认证或已禁用，不 fallback 到本地 session
        if (!result.ok && (result.status === 401 || result.status === 403)) {
            return NextResponse.json({ user: null });
        }

        if (!result.ok || !data.success || !data.data) {
            // 其他错误（如 500、参数错误等）：可能为临时故障，回退到本地 session
            const localResponse = await getLocalSessionUser();
            return localResponse || NextResponse.json({ user: null });
        }

        const userPayload = data.data;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            logger.warn(`[AUDIT] Phone collision detected (me): new user ${userPayload.id} conflicts with existing user ${existingByPhone.id}.`);
            await prisma.user.update({
                where: { id: existingByPhone.id },
                data: { phoneNumber: `merged_${existingByPhone.id}_${userPayload.phone}` }
            });
        }

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

        const responseUser = {
            id: userPayload.id,
            phone: userPayload.phone,
            name: userPayload.nickname || userPayload.phone,
            avatar: userPayload.avatar,
            role: localUser.role,
            createdAt: userPayload.createdAt,
            stats: userPayload.stats,
        };

        const responsePayload = { user: responseUser };
        setMeCache(cacheKey, responsePayload);

        const response = NextResponse.json(responsePayload);

        // 签发/刷新子站本地 session，让后续本地 API 能正确识别用户
        await signLocalSession(response, {
            id: responseUser.id,
            email: null,
            phone: responseUser.phone || null,
            name: responseUser.name,
            role: responseUser.role,
            tokenVersion: localUser.tokenVersion,
            dailyTestLimit: localUser.dailyTestLimit,
        });

        mirrorOfficialCookies(result.officialResponse, response, "me");

        return response;

    } catch (e) {
        logger.error("Me GET Proxy Error", e);
        const localResponse = await getLocalSessionUser();
        return localResponse || NextResponse.json({ user: null });
    }
}

export async function PUT(req: NextRequest) {
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`me-put-ip-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
    if (!ipLimit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    if (!allCookies) {
        return apiError(ErrorCode.UNAUTHORIZED, "Not authenticated", 401);
    }

    try {
        const body = await req.json();

        // 官网 PUT /api/user/profile 只接受 nickname / avatar
        // 子站前端可能使用 name，这里做字段映射
        const officialBody: { nickname?: string; avatar?: string } = {};
        if (body.nickname !== undefined) {
            officialBody.nickname = body.nickname;
        } else if (body.name !== undefined) {
            officialBody.nickname = body.name;
        }
        if (body.avatar !== undefined) {
            officialBody.avatar = body.avatar;
        }

        const result = await callOfficialApi<OfficialApiResponse<{ user: OfficialProfileUser }>>({
            method: "PUT",
            path: "/api/user/profile",
            body: officialBody,
            cookies: allCookies,
            requireSignature: false,
            timeoutMs: 30000,
        });

        if (!result) {
            return apiError(ErrorCode.UPSTREAM_ERROR, "更新失败：上游服务响应异常", 502);
        }

        const data = result.data;

        if (!result.ok || !data.success || !data.data?.user) {
            return apiError(ErrorCode.VALIDATION_ERROR, data.error?.message || "更新失败", result.status || 400);
        }

        const user = data.data.user;

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                phone: user.phone,
                name: user.nickname || user.phone,
                avatar: user.avatar,
                role: UserRole.USER
            }
        });
    } catch (e) {
        logger.error("Me PUT Proxy Error", e);
        return apiError(ErrorCode.INTERNAL_ERROR, "应用系统异常，请稍后重试", 500);
    }
}
