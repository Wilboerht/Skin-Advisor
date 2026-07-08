import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { signToken, getSession, AUTH_COOKIE_NAME } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";
import { createHash } from "crypto";
import { UserRole } from "@/lib/permissions";
import { generateCsrfToken, CSRF_COOKIE_NAME } from "@/lib/csrf";

// 简单的内存缓存，防止外部官方 API 慢导致每个请求都阻塞 10s+
// 注意：Next.js Serverless 环境中内存缓存不共享，仅做单请求级减负
const meCache = new Map<string, { data: unknown; timestamp: number }>();
const ME_CACHE_TTL_MS = 5000; // 5 秒缓存
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
        console.error("[auth/me] Local session lookup failed:", err);
        return null;
    }
}

export async function GET(req: NextRequest) {
    // 速率限制
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`me-get-ip-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!ipLimit.success) {
        return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }

    const cookieStore = await cookies();
    // 官网下发的是 user_token 或者 auth_token，但统一通过 cookie 转发
    // 我们获取当前所有的 cookie
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    // 没有官网 cookie 时，直接尝试本地 token（开发环境本地登录只签发 auth_token）
    if (!allCookies) {
        const localResponse = await getLocalSessionUser();
        return localResponse || NextResponse.json({ user: null });
    }

    try {
        const cacheKey = getCacheKey(allCookies);
        const cached = getMeCache(cacheKey);
        if (cached) {
            // Cache hit — skip external API call
            return NextResponse.json(cached);
        }

        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";

        // Add a timeout to prevent long hangs if the official API is unreachable
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时：针对 demo 服务器不稳定的环境

        const officialResponse = await fetch(`${officialApiUrl}/api/auth/me`, {
            method: "GET",
            headers: {
                "Cookie": allCookies
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const contentType = officialResponse.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            console.error("Official API returned non-JSON response", await officialResponse.text());
            const localResponse = await getLocalSessionUser();
            return localResponse || NextResponse.json({ user: null });
        }

        const data = await officialResponse.json();

        if (!officialResponse.ok || !data.success) {
            // 官网未识别时，回退到本地 token（开发环境本地登录场景）
            const localResponse = await getLocalSessionUser();
            return localResponse || NextResponse.json({ user: null });
        }

        const userPayload = data.data.user;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            console.warn(`[AUDIT] Phone collision detected (me): new user ${userPayload.id} (phone: ${userPayload.phone}) conflicts with existing user ${existingByPhone.id}. Merging old record.`);
            await prisma.user.update({
                where: { id: existingByPhone.id },
                data: { phoneNumber: `merged_${existingByPhone.id}_${userPayload.phone}` }
            });
        }

        // Upsert user into local database so foreign keys (like History) don't break
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
                role: UserRole.USER
            }
        });

        // 使用本地 DB 的 role（管理端可能已禁用/修改），而非官网固定 UserRole.USER
        const responseUser = {
            ...data.data.user,
            phone: data.data.user.phone,
            name: data.data.user.nickname || data.data.user.phone,
            role: localUser.role
        };

        const responsePayload = { user: responseUser };

        // 写入缓存，5s 内相同 cookie 的请求不再访问外部 API
        setMeCache(cacheKey, responsePayload);

        const response = NextResponse.json(responsePayload);

        // 签发本地 JWT token，让后续本地 API (analyze, test-limit 等) 能正确识别用户
        // 官网的 user_token 是用官网 secret 签发的，本地无法验证，所以必须重新签发
        try {
            const csrfToken = generateCsrfToken();
            const localToken = await signToken({
                sub: responseUser.id,
                email: responseUser.email || null,
                phone: responseUser.phone || null,
                name: responseUser.name,
                role: responseUser.role,
                dailyTestLimit: localUser.dailyTestLimit,
                csrf: csrfToken,
            }, "7d");
            response.cookies.set(AUTH_COOKIE_NAME, localToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60, // 7天
                path: "/"
            });
            response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
                httpOnly: false, // 前端需要读取以放入 header
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60,
                path: "/"
            });
            // Local auth_token issued successfully
        } catch (tokenErr) {
            console.error("[auth/me] Failed to issue local token:", tokenErr);
        }

        mirrorOfficialCookies(officialResponse, response, "me");

        return response;

    } catch (e) {
        console.error("Me GET Proxy Error", e);

        // 官网 API 不可用时的降级方案：尝试用本地 token 直接识别用户
        const localResponse = await getLocalSessionUser();
        return localResponse || NextResponse.json({ user: null });
    }
}

export async function PUT(req: NextRequest) {
    // 1. 速率限制
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`me-put-ip-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
    if (!ipLimit.success) {
        return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    if (!allCookies) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    try {
        const body = await req.json();

        // 2. 代理到官网的 PUT /api/auth/me 去修改资料（带超时）
        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const officialResponse = await fetch(`${officialApiUrl}/api/auth/me`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Cookie": allCookies
            },
            body: JSON.stringify(body),
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        const data = await officialResponse.json();

        if (!officialResponse.ok || !data.success) {
            return NextResponse.json({ error: data.error?.message || "更新失败" }, { status: officialResponse.status || 400 });
        }

        return NextResponse.json({
            success: true,
            user: {
                ...data.data.user,
                phone: data.data.user.phone,
                name: data.data.user.nickname || data.data.user.phone,
                role: UserRole.USER
            }
        });
    } catch (e) {
        console.error("Me PUT Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
