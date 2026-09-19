import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { OFFICIAL_BASE_URL } from "@/lib/account-bff";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const BALANCE_PATH = "/api/v1/internal/points/balance";
const BALANCE_TIMEOUT_MS = 5000;

function degraded() {
    // 积分是展示级数据：任何失败都降级为 available:null，前端据此隐藏积分入口
    return NextResponse.json({ available: null });
}

// GET: 经官网内部 API（HMAC 签名）查询积分余额。
// 官网是积分权威账本；官网不可达/签名未配置/无手机号时降级 { available: null }。
// 官网响应结构为 { success: true, data: { available, frozen, redeemRate, membershipLevel } }。
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

    const phone = user.phone;
    if (!phone) {
        return degraded();
    }

    try {
        const signed = await createSignedInternalApiHeaders("advisor", "GET", BALANCE_PATH, "");
        if (!signed) {
            logger.warn("[account/points] 未配置内部 API 密钥，积分查询降级");
            return degraded();
        }

        const res = await fetch(`${OFFICIAL_BASE_URL}${BALANCE_PATH}?phone=${encodeURIComponent(phone)}`, {
            headers: signed.headers,
            signal: AbortSignal.timeout(BALANCE_TIMEOUT_MS),
        });

        if (!res.ok) {
            logger.warn("[account/points] 官网积分查询失败", { status: res.status });
            return degraded();
        }

        const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            data?: { available?: number; redeemRate?: number; membershipLevel?: string };
        } | null;
        const data = json?.data;
        if (!data || typeof data.available !== "number") {
            logger.warn("[account/points] 官网积分响应异常");
            return degraded();
        }

        return NextResponse.json({
            available: data.available,
            redeemRate: data.redeemRate ?? null,
            membershipLevel: data.membershipLevel ?? null,
        });
    } catch (err) {
        logger.warn("[account/points] 官网积分查询异常", { error: String(err) });
        return degraded();
    }
}
