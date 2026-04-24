import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// 简单的内存缓存，防止外部官方 API 慢导致每个请求都阻塞 10s+
// Key = cookie 字符串 hash, Value = 官方 API 返回的 data
const meCache = new Map<string, { data: any; timestamp: number }>();
const ME_CACHE_TTL_MS = 5000; // 5 秒缓存

function getCacheKey(cookieStr: string): string {
    let hash = 0;
    for (let i = 0; i < cookieStr.length; i++) {
        hash = ((hash << 5) - hash) + cookieStr.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
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
        const cacheKey = getCacheKey(allCookies);
        const cached = meCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < ME_CACHE_TTL_MS) {
            console.log("[auth/me] Returning cached user data (cache hit)");
            // 缓存命中时仍需要 upsert 本地用户，但跳过外部 API 调用
            // 为了简化，缓存只缓存最终返回结果，不包含 cookie 镜像逻辑
            // 如果 cookie 快过期，这可能有风险，但 5s 缓存影响极小
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

        const responsePayload = {
            user: {
                ...data.data.user,
                phone: data.data.user.phone,
                name: data.data.user.nickname || data.data.user.phone,
                role: "user"
            }
        };

        // 写入缓存，5s 内相同 cookie 的请求不再访问外部 API
        meCache.set(cacheKey, { data: responsePayload, timestamp: Date.now() });

        const response = NextResponse.json(responsePayload);

        mirrorOfficialSessionCookie(officialResponse, response);

        return response;

    } catch (e) {
        console.error("Me GET Proxy Error", e);
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
