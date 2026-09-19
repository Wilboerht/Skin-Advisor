import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import { resolveOfficialAccessToken, OFFICIAL_BASE_URL } from "@/lib/account-bff";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const OFFICIAL_MEMBERSHIP_TIMEOUT_MS = 8000;
/** 进程内缓存：防前端连点/多组件同时拉取打爆官网 */
const CACHE_TTL_MS = 30 * 1000;
/** 缓存上限：PM2 常驻进程下防止按用户键无界增长 */
const CACHE_MAX_ENTRIES = 500;

const membershipCache = new Map<string, { at: number; data: unknown }>();

function cacheSet(key: string, data: unknown) {
    // 先淘汰过期条目；仍超限再淘汰最旧（Map 保持插入序）
    const now = Date.now();
    for (const [k, v] of membershipCache) {
        if (now - v.at >= CACHE_TTL_MS) membershipCache.delete(k);
    }
    if (membershipCache.size >= CACHE_MAX_ENTRIES) {
        const oldest = membershipCache.keys().next().value;
        if (oldest !== undefined) membershipCache.delete(oldest);
    }
    membershipCache.set(key, { at: now, data });
}

// GET: 代理官网 GET /api/oauth/membership（Bearer 转发），原样透传，30 秒进程内缓存。
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user) {
        return NextResponse.json({ error: "unauthorized", message: "请先登录" }, { status: 401 });
    }

    // 按用户限流：回源走同一出口 IP，防单个用户耗尽全站共享的官网配额
    const limit = await rateLimit(`account:${user.id}`, "default", { maxRequests: 60, windowMs: 60_000 });
    if (!limit.success) {
        return NextResponse.json({ error: "rate_limited", message: "请求过于频繁，请稍后再试" }, { status: 429 });
    }

    const cached = membershipCache.get(user.id);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return NextResponse.json(cached.data);
    }

    const token = await resolveOfficialAccessToken(req);
    if (!token) {
        return NextResponse.json({ error: "unauthorized", message: "登录已过期，请重新登录" }, { status: 401 });
    }

    let res: Response;
    try {
        res = await fetch(`${OFFICIAL_BASE_URL}/api/oauth/membership`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(OFFICIAL_MEMBERSHIP_TIMEOUT_MS),
        });
    } catch (err) {
        logger.warn("[account/membership] 官网不可达", { error: String(err) });
        return NextResponse.json({ error: "upstream_error", message: "官网服务连接失败，请稍后再试" }, { status: 502 });
    }

    if (res.status === 401) {
        return NextResponse.json({ error: "unauthorized", message: "登录已过期，请重新登录" }, { status: 401 });
    }
    if (!res.ok) {
        logger.warn("[account/membership] 官网响应异常", { status: res.status });
        return NextResponse.json({ error: "upstream_error", message: "官网服务暂时不可用，请稍后再试" }, { status: 502 });
    }

    const data = await res.json().catch(() => null);
    if (!data) {
        return NextResponse.json({ error: "upstream_error", message: "官网服务暂时不可用，请稍后再试" }, { status: 502 });
    }

    cacheSet(user.id, data);
    return NextResponse.json(data);
}
