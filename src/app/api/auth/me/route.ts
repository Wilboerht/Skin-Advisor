import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { signToken, getSession } from "@/lib/auth";

// 简单的内存缓存，防止外部官方 API 慢导致每个请求都阻塞 10s+
// Key = cookie 字符串 hash, Value = 官方 API 返回的 data
const meCache = new Map<string, { data: any; timestamp: number }>();
const ME_CACHE_TTL_MS = 5000; // 5 秒缓存
const MAX_CACHE_SIZE = 1000;

function getCacheKey(cookieStr: string): string {
    let hash = 0;
    for (let i = 0; i < cookieStr.length; i++) {
        hash = ((hash << 5) - hash) + cookieStr.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
}

function setMeCache(key: string, value: { data: any; timestamp: number }) {
    // Evict oldest entries if cache exceeds max size
    if (meCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = meCache.keys().next().value;
        if (oldestKey) meCache.delete(oldestKey);
    }
    meCache.set(key, value);
}

function cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of meCache.entries()) {
        if (now - entry.timestamp > ME_CACHE_TTL_MS * 2) {
            meCache.delete(key);
        }
    }
}

function mirrorOfficialSessionCookie(officialResponse: Response, response: NextResponse) {
    const setCookieHeader = officialResponse.headers.get("set-cookie");
    
    if (!setCookieHeader) {
        console.warn("⚠️  Official API (me) did NOT return set-cookie header - session cookie may need renewal");
        // 即使官方 API 没有返回 cookie，也不中断流程
        // 客户端应该保留现有的 token cookie
        return;
    }

    console.log(`📝 Official API (me) returned cookie: ${setCookieHeader.substring(0, 50)}...`);

    // Handle potentially multiple Set-Cookie headers (可能是用逗号或其他方式分隔)
    const cookieLines = setCookieHeader.split(/,(?=\s*\w+\s*=)/);
    
    for (const cookieStr of cookieLines) {
        const trimmed = cookieStr.trim();
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        
        const cookieName = trimmed.substring(0, eqIdx).trim();
        const rest = trimmed.substring(eqIdx + 1);
        const semiIdx = rest.indexOf(";");
        const cookieValue = (semiIdx === -1 ? rest : rest.substring(0, semiIdx)).trim();
        
        if (!cookieName || !cookieValue) continue;

        console.log(`✅ Setting cookie on response (me): ${cookieName}`);
        response.cookies.set(cookieName, cookieValue, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30
        });
    }
}


export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    // 官网下发的是 user_token 或者 auth_token，但统一通过 cookie 转发
    // 我们获取当前所有的 cookie
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    if (!allCookies) {
        return NextResponse.json({ user: null });
    }

    try {
        cleanupExpiredCache();
        const cacheKey = getCacheKey(allCookies);
        const cached = meCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < ME_CACHE_TTL_MS) {
            console.log("[auth/me] Returning cached user data (cache hit)");
            return NextResponse.json(cached.data);
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
            return NextResponse.json({ user: null });
        }

        const data = await officialResponse.json();

        if (!officialResponse.ok || !data.success) {
            return NextResponse.json({ user: null });
        }

        const userPayload = data.data.user;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            await prisma.user.update({
                where: { id: existingByPhone.id },
                data: { phoneNumber: `merged_${existingByPhone.id}_${userPayload.phone}` }
            });
        }

        // Upsert user into local database so foreign keys (like History) don't break
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

        const responseUser = {
            ...data.data.user,
            phone: data.data.user.phone,
            name: data.data.user.nickname || data.data.user.phone,
            role: "user"
        };

        const responsePayload = { user: responseUser };

        // 写入缓存，5s 内相同 cookie 的请求不再访问外部 API
        setMeCache(cacheKey, { data: responsePayload, timestamp: Date.now() });

        const response = NextResponse.json(responsePayload);

        // 签发本地 JWT token，让后续本地 API (analyze, test-limit 等) 能正确识别用户
        // 官网的 user_token 是用官网 secret 签发的，本地无法验证，所以必须重新签发
        try {
            const localToken = await signToken({
                sub: responseUser.id,
                email: responseUser.email || null,
                phone: responseUser.phone || null,
                name: responseUser.name,
                role: responseUser.role
            }, "7d");
            response.cookies.set("auth_token", localToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60, // 7天
                path: "/"
            });
            console.log("[auth/me] Issued local auth_token for user:", userPayload.id);
        } catch (tokenErr) {
            console.error("[auth/me] Failed to issue local token:", tokenErr);
        }

        mirrorOfficialSessionCookie(officialResponse, response);

        return response;

    } catch (e) {
        console.error("Me GET Proxy Error", e);

        // 官网 API 不可用时的降级方案：尝试用本地 token 直接识别用户
        try {
            const localUser = await getSession();
            if (localUser) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: localUser.id },
                    select: { id: true, phoneNumber: true, name: true, avatarUrl: true, role: true }
                });
                if (dbUser) {
                    console.log("[auth/me] Official API unreachable, serving user from local DB:", dbUser.id);
                    return NextResponse.json({
                        user: {
                            id: dbUser.id,
                            phone: dbUser.phoneNumber,
                            name: dbUser.name || dbUser.phoneNumber,
                            avatar: dbUser.avatarUrl,
                            role: dbUser.role || "user"
                        }
                    });
                }
            }
        } catch (localErr) {
            console.error("[auth/me] Local fallback also failed:", localErr);
        }

        return NextResponse.json({ user: null });
    }
}

export async function PUT(req: NextRequest) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    if (!allCookies) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    try {
        const body = await req.json();

        // 我们代理到官网的 PUT /api/auth/me 去修改资料
        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        const officialResponse = await fetch(`${officialApiUrl}/api/auth/me`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Cookie": allCookies
            },
            body: JSON.stringify(body)
        });

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
                role: "user"
            }
        });
    } catch (e) {
        console.error("Me PUT Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
