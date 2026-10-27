/**
 * 微信登录用户的会员数据回源
 *
 * 微信登录不走 SSO 授权码流程，没有 access token，无法调 userinfo 获取
 * membershipLevel（它决定测肤四档配额）。官网内部接口中 advisor 可用的
 * 会员数据源是 GET /api/v1/internal/points/balance（按手机号查，响应含
 * membershipLevel；若官网后续补充 totalSpent 也一并读取）。
 *
 * 失败一律降级为 null（不阻断登录），与 /api/account/points 的降级口径一致。
 */
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { OFFICIAL_BASE_URL } from "@/lib/account-bff";
import { logger } from "@/lib/logger";

const BALANCE_PATH = "/api/v1/internal/points/balance";
const BALANCE_TIMEOUT_MS = 5000;

export interface OfficialMembership {
    level: string | null;
    totalSpent: number | null;
}

export async function fetchOfficialMembership(phone: string | null | undefined): Promise<OfficialMembership> {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return { level: null, totalSpent: null };
    }
    try {
        const query = `phone=${encodeURIComponent(phone)}`;
        const signed = await createSignedInternalApiHeaders("advisor", "GET", BALANCE_PATH, "", { query });
        if (!signed) {
            logger.warn("[official-membership] 未配置内部 API 密钥，会员数据回源跳过");
            return { level: null, totalSpent: null };
        }
        const res = await fetch(`${OFFICIAL_BASE_URL}${BALANCE_PATH}?${query}`, {
            headers: signed.headers,
            signal: AbortSignal.timeout(BALANCE_TIMEOUT_MS),
        });
        if (!res.ok) {
            logger.warn("[official-membership] 官网会员查询失败", { status: res.status });
            return { level: null, totalSpent: null };
        }
        const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            data?: { membershipLevel?: string; totalSpent?: number; total_spent?: number };
        } | null;
        const data = json?.data;
        const level = typeof data?.membershipLevel === "string" && data.membershipLevel
            ? data.membershipLevel
            : null;
        const rawSpent = data?.totalSpent ?? data?.total_spent;
        const totalSpent = typeof rawSpent === "number" && Number.isFinite(rawSpent)
            ? Math.max(0, Math.round(rawSpent))
            : null;
        return { level, totalSpent };
    } catch (err) {
        logger.warn("[official-membership] 官网会员查询异常", { error: String(err) });
        return { level: null, totalSpent: null };
    }
}

export async function fetchOfficialMembershipLevel(phone: string | null | undefined): Promise<string | null> {
    return (await fetchOfficialMembership(phone)).level;
}
