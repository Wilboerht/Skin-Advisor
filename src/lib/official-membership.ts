/**
 * 微信登录用户的会员数据回源
 *
 * 微信登录不走 SSO 授权码流程，没有 access token，无法调 userinfo 获取
 * membershipLevel（它决定测肤四档配额）。官网内部接口中 advisor 可用的
 * 会员数据源是 GET /api/v1/internal/points/balance（按手机号查，响应含
 * membershipLevel）；/api/v1/internal/user/status 只返回账号状态，
 * 不含会员数据，totalSpent 无 advisor 可用的查询接口。
 *
 * 失败一律降级为 null（不阻断登录），与 /api/account/points 的降级口径一致。
 */
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { OFFICIAL_BASE_URL } from "@/lib/account-bff";
import { logger } from "@/lib/logger";

const BALANCE_PATH = "/api/v1/internal/points/balance";
const BALANCE_TIMEOUT_MS = 5000;

/**
 * 按真实手机号查询主站会员等级。掩码/格式异常的手机号直接返回 null
 * （主站 zod 校验 /^1[3-9]\d{9}$/，掩码值必 400，不打无意义的回源）。
 */
export async function fetchOfficialMembershipLevel(phone: string | null | undefined): Promise<string | null> {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return null;
    try {
        // GET 无请求体：签名按空串 body 计算（与主站校验侧一致）
        const signed = await createSignedInternalApiHeaders("advisor", "GET", BALANCE_PATH, "");
        if (!signed) {
            logger.warn("[official-membership] 未配置内部 API 密钥，会员等级回源跳过");
            return null;
        }
        const res = await fetch(`${OFFICIAL_BASE_URL}${BALANCE_PATH}?phone=${encodeURIComponent(phone)}`, {
            headers: signed.headers,
            signal: AbortSignal.timeout(BALANCE_TIMEOUT_MS),
        });
        if (!res.ok) {
            logger.warn("[official-membership] 官网会员查询失败", { status: res.status });
            return null;
        }
        const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            data?: { membershipLevel?: string };
        } | null;
        const level = json?.data?.membershipLevel;
        return typeof level === "string" && level ? level : null;
    } catch (err) {
        logger.warn("[official-membership] 官网会员查询异常", { error: String(err) });
        return null;
    }
}
