/**
 * 用户状态同步工具
 *
 * 通过官网内部 API 校验用户账号状态，解决官网禁用/封禁用户后子站无法及时同步的问题。
 *
 * 设计：
 * - 使用内存缓存减少对官网 API 的调用频率（默认 TTL 2 分钟）
 * - 当官网 API 不可达时，采用"乐观信任"策略（保留本地会话，不误杀）
 * - 当官网明确返回用户不可用时，返回 false 触发本地会话失效
 */
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { logger } from "@/lib/logger";

const OFFICIAL_PATH = "/api/v1/internal/user/status";
const OFFICIAL_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 分钟

interface UserStatusResult {
    valid: boolean;
    officialStatus: string | null; // 官网返回的实际状态，null 表示请求失败
}

interface CacheEntry {
    result: UserStatusResult;
    timestamp: number;
}

const statusCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 5000;

function getCached(userId: string): UserStatusResult | null {
    const entry = statusCache.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        statusCache.delete(userId);
        return null;
    }
    return entry.result;
}

function setCached(userId: string, result: UserStatusResult): void {
    if (statusCache.size >= MAX_CACHE_SIZE) {
        const firstKey = statusCache.keys().next().value as string | undefined;
        if (firstKey) statusCache.delete(firstKey);
    }
    statusCache.set(userId, { result, timestamp: Date.now() });
}

/**
 * 从缓存中删除指定用户的条目（用于主动失效场景，如 webhook）
 */
export function invalidateUserStatusCache(userId: string): void {
    statusCache.delete(userId);
}

/**
 * 调用官网内部 API 校验用户状态
 *
 * @returns UserStatusResult
 *   - valid=true: 用户状态正常，可继续使用
 *   - valid=false + officialStatus!=null: 官网确认用户已禁用/封禁/不存在
 *   - valid=true + officialStatus==null: 官网 API 不可达，采用乐观策略
 */
export async function verifyUserStatus(userId: string): Promise<UserStatusResult> {
    // 1. 检查缓存
    const cached = getCached(userId);
    if (cached) return cached;

    // 2. 调用官网内部 API
    const officialApiUrl = process.env.OFFICIAL_API_URL;
    if (!officialApiUrl) {
        // 未配置官网地址（开发环境可能没有），跳过校验
        logger.warn("[UserSync] OFFICIAL_API_URL 未配置，跳过用户状态校验");
        return { valid: true, officialStatus: null };
    }

    try {
        const body = { userId };
        const bodyText = JSON.stringify(body);

        const signed = await createSignedInternalApiHeaders("advisor", "POST", OFFICIAL_PATH, bodyText);
        if (!signed) {
            // 未配置内部 API 密钥，跳过校验
            logger.warn("[UserSync] 内部 API 密钥未配置，跳过用户状态校验");
            return { valid: true, officialStatus: null };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OFFICIAL_TIMEOUT_MS);

        const response = await fetch(`${officialApiUrl}${OFFICIAL_PATH}`, {
            method: "POST",
            headers: signed.headers,
            body: bodyText,
            signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
            logger.warn(`[UserSync] 官网 user/status 返回非 200: ${response.status}`, { userId });
            const optimistic: UserStatusResult = { valid: true, officialStatus: null };
            setCached(userId, optimistic);
            return optimistic;
        }

        const data = await response.json() as {
            success: boolean;
            data?: { userId: string; status: string; phone?: string };
        };

        if (!data.success || !data.data) {
            logger.warn("[UserSync] 官网 user/status 返回异常数据", { userId });
            const optimistic: UserStatusResult = { valid: true, officialStatus: null };
            setCached(userId, optimistic);
            return optimistic;
        }

        const userData = data.data;
        const isActive = userData.status === "ACTIVE";
        const result: UserStatusResult = {
            valid: isActive,
            officialStatus: userData.status,
        };

        // 对不可用状态使用更短的 TTL（30 秒），以更快地对恢复做出反应
        if (!isActive) {
            statusCache.set(userId, {
                result,
                timestamp: Date.now() - CACHE_TTL_MS + 30_000,
            });
        } else {
            setCached(userId, result);
        }

        return result;
    } catch (error) {
        logger.warn("[UserSync] 官网 user/status 请求失败（网络/超时）:", { userId, error: String(error) });
        // 网络不可达时采用乐观策略：不因官网暂时宕机而踢掉所有用户
        const optimistic: UserStatusResult = { valid: true, officialStatus: null };
        setCached(userId, optimistic);
        return optimistic;
    }
}
