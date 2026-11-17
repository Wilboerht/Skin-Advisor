import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { logger } from "@/lib/logger";

export type MainUserStatus =
    | "ACTIVE"
    | "SUSPENDED"
    | "BANNED"
    | "DELETED"
    | "NOT_FOUND";

const STATUS_PATH = "/api/v1/internal/user/status";
const OFFICIAL_BASE_URL = (process.env.OFFICIAL_API_URL || "https://nihplod.cn").replace(/\/+$/, "");
const CACHE_TTL_MS = 60_000;
const FAILURE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 3_000;

interface CacheEntry {
    /** 最近一次成功查询到的状态；从未成功查询过为 undefined */
    status?: MainUserStatus;
    /** 缓存过期时间戳 */
    expiresAt: number;
    /** 是否为失败缓存（true=查询失败，false=成功） */
    failed: boolean;
}

const cache = new Map<string, CacheEntry>();
let warnedMissingKey = false;

function isMainUserStatus(value: unknown): value is MainUserStatus {
    return (
        value === "ACTIVE" ||
        value === "SUSPENDED" ||
        value === "BANNED" ||
        value === "DELETED" ||
        value === "NOT_FOUND"
    );
}

function readCache(userId: string): { hit: boolean; entry?: CacheEntry } {
    const entry = cache.get(userId);
    if (!entry) return { hit: false };
    if (entry.expiresAt <= Date.now()) {
        // 过期缓存不立即删除：isMainUserActive 需要参考最近已知状态做安全判定
        return { hit: false, entry };
    }
    return { hit: true, entry };
}

function writeCache(userId: string, status: MainUserStatus | null, ttlMs: number, failed: boolean): void {
    cache.set(userId, {
        status: status ?? undefined,
        expiresAt: Date.now() + ttlMs,
        failed,
    });
}

/**
 * 查询主站用户状态。
 * - 成功：返回状态并缓存 60 秒
 * - 失败：返回 null 并缓存 30 秒（避免主站抖动时每个请求都回源）
 * - 从未成功查询过且失败：返回 null（调用方按 fail-open 处理）
 */
export async function fetchMainUserStatus(userId: string): Promise<MainUserStatus | null> {
    const cached = readCache(userId);
    if (cached.hit && cached.entry) {
        // 成功缓存返回状态；失败缓存返回 null（30 秒内不再回源）
        return cached.entry.failed ? null : (cached.entry.status ?? null);
    }

    const bodyText = JSON.stringify({ userId });
    const signed = await createSignedInternalApiHeaders("advisor", "POST", STATUS_PATH, bodyText);
    if (!signed) {
        if (!warnedMissingKey) {
            warnedMissingKey = true;
            logger.warn(
                "[MainUserStatus] 未配置 INTERNAL_API_KEYS（project=advisor），跳过主站状态检查"
            );
        }
        writeCache(userId, null, FAILURE_TTL_MS, true);
        return null;
    }

    try {
        const res = await fetch(`${OFFICIAL_BASE_URL}${STATUS_PATH}`, {
            method: "POST",
            headers: signed.headers,
            body: bodyText,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as {
            success?: boolean;
            data?: { status?: unknown };
        } | null;
        const status = data?.success ? data.data?.status : undefined;
        if (res.ok && isMainUserStatus(status)) {
            writeCache(userId, status, CACHE_TTL_MS, false);
            return status;
        }
        logger.warn("[MainUserStatus] 主站状态查询失败", { userId, status: res.status });
        writeCache(userId, null, FAILURE_TTL_MS, true);
        return null;
    } catch (error) {
        logger.warn("[MainUserStatus] 主站状态查询异常", {
            userId,
            error: String(error),
        });
        writeCache(userId, null, FAILURE_TTL_MS, true);
        return null;
    }
}

/**
 * 判断主站用户是否活跃。
 *
 * 安全策略（部分 fail-closed）：
 * - 最近已知状态为 SUSPENDED/BANNED/DELETED/NOT_FOUND：即使本次查询失败也拒绝访问，
 *   防止主站故障期间被封禁用户继续操作。
 * - 最近已知状态为 ACTIVE：查询失败时放行（避免主站抖动误伤正常用户）。
 * - 从未成功查询过：查询失败时放行（新用户/主站未接入时不阻断业务）。
 */
export async function isMainUserActive(userId: string): Promise<boolean> {
    const cached = readCache(userId);
    const status = await fetchMainUserStatus(userId);

    // 查询成功：直接按最新状态判定
    if (status !== null) {
        return status === "ACTIVE";
    }

    // 查询失败：参考最近已知状态（即使已过期也作为安全依据）
    const lastKnown = cached.entry?.status;
    if (lastKnown && lastKnown !== "ACTIVE") {
        logger.warn("[MainUserStatus] 查询失败且最近已知状态非 ACTIVE，拒绝访问", {
            userId,
            lastKnown,
        });
        return false;
    }

    // 无历史记录或最近已知为 ACTIVE：fail-open，避免主站故障阻断正常用户
    return true;
}

export function __resetMainUserStatusCacheForTests(): void {
    cache.clear();
    warnedMissingKey = false;
}
