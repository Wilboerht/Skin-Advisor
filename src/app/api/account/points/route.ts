import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/sso-auth";
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { logger } from "@/lib/logger";

const BALANCE_PATH = "/api/v1/internal/points/balance";
const BALANCE_TIMEOUT_MS = 5000;

function degraded() {
    // 积分是展示级数据：任何失败都降级为 available:null，前端据此隐藏积分入口
    return NextResponse.json({ available: null });
}

// GET: 经官网内部 API（HMAC 签名）查询积分余额。
// 官网是积分权威账本；官网不可达/签名未配置/无手机号时降级 { available: null }。
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user) {
        return NextResponse.json({ error: "unauthorized", message: "请先登录" }, { status: 401 });
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

        const officialApiUrl = (process.env.OFFICIAL_API_URL || "https://nihplod.cn").replace(/\/+$/, "");
        const res = await fetch(`${officialApiUrl}${BALANCE_PATH}?phone=${encodeURIComponent(phone)}`, {
            headers: signed.headers,
            signal: AbortSignal.timeout(BALANCE_TIMEOUT_MS),
        });

        if (!res.ok) {
            logger.warn("[account/points] 官网积分查询失败", { status: res.status });
            return degraded();
        }

        const data = (await res.json().catch(() => null)) as {
            available?: number;
            redeemRate?: number;
            membershipLevel?: string;
        } | null;
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
