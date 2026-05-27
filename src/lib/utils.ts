import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number) {
    return new Date(date).toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

export function formatDateTime(date: Date | string | number) {
    return new Date(date).toLocaleString("zh-CN", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
    });
}

/**
 * 数据库查询重试包装器
 * 针对 Supabase/PgBouncer 连接不稳定问题，自动重试连接断开错误
 */
export async function withDbRetry<T>(
    fn: () => Promise<T>,
    retries = 2,
    delayMs = 100
): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (e: unknown) {
            lastError = e instanceof Error ? e : new Error(String(e));
            const isConnectionError =
                e instanceof Error && (
                    e.message.includes("Connection terminated unexpectedly") ||
                    e.message.includes("Connection terminated due to connection timeout") ||
                    e.message.includes("Can't reach database server")
                );

            if (!isConnectionError || i === retries) {
                throw lastError;
            }

            console.warn(`[DB Retry] Connection error, retrying ${i + 1}/${retries}...`);
            await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        }
    }
    throw lastError!;
}
