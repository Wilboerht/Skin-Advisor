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

const cache = new Map<string, { status: MainUserStatus | null; expiresAt: number }>();
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

function readCache(userId: string): { hit: boolean; status: MainUserStatus | null } {
    const entry = cache.get(userId);
    if (!entry) return { hit: false, status: null };
    if (entry.expiresAt <= Date.now()) {
        cache.delete(userId);
        return { hit: false, status: null };
    }
    return { hit: true, status: entry.status };
}

function writeCache(userId: string, status: MainUserStatus | null, ttlMs: number): void {
    cache.set(userId, { status, expiresAt: Date.now() + ttlMs });
}

/**
 * 查询主站用户状态。失败时返回 null（fail-open），由调用方决定是否放行。
 * 结果缓存 60 秒；查询失败缓存 30 秒，避免主站抖动时每个请求都回源。
 */
export async function fetchMainUserStatus(userId: string): Promise<MainUserStatus | null> {
    const cached = readCache(userId);
    if (cached.hit) return cached.status;

    const bodyText = JSON.stringify({ userId });
    const signed = await createSignedInternalApiHeaders("advisor", "POST", STATUS_PATH, bodyText);
    if (!signed) {
        if (!warnedMissingKey) {
            warnedMissingKey = true;
            logger.warn(
                "[MainUserStatus] 未配置 INTERNAL_API_KEYS（project=advisor），跳过主站状态检查"
            );
        }
        writeCache(userId, null, FAILURE_TTL_MS);
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
            writeCache(userId, status, CACHE_TTL_MS);
            return status;
        }
        logger.warn("[MainUserStatus] 主站状态查询失败", { userId, status: res.status });
        writeCache(userId, null, FAILURE_TTL_MS);
        return null;
    } catch (error) {
        logger.warn("[MainUserStatus] 主站状态查询异常", {
            userId,
            error: String(error),
        });
        writeCache(userId, null, FAILURE_TTL_MS);
        return null;
    }
}

export async function isMainUserActive(userId: string): Promise<boolean> {
    const status = await fetchMainUserStatus(userId);
    return status === null || status === "ACTIVE";
}

export function __resetMainUserStatusCacheForTests(): void {
    cache.clear();
    warnedMissingKey = false;
}
