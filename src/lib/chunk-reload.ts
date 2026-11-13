/**
 * 部署切换期的 chunk 加载错误兜底。
 *
 * 每次发布后静态 chunk 的哈希会变化，仍停留在旧页面（或浏览器还缓存着旧 HTML）的
 * 用户会请求到已删除的 chunk，触发 ChunkLoadError。此时 error boundary 里的
 * retry() 只是重渲染，不会重新拉取 HTML，用户会卡在错误页；整页刷新一次即可
 * 拿到新构建的资源。
 */

const RELOAD_GUARD_KEY = "advisor_chunk_error_reload_at";
const RELOAD_GUARD_WINDOW_MS = 10_000;

/** 是否为 chunk 加载失败（webpack ChunkLoadError 及其常见文案） */
export function isChunkLoadError(error: unknown): boolean {
    if (!error) return false;
    if (typeof error === "string") {
        return /Loading (CSS )?chunk .* failed/i.test(error) || /Failed to load chunk/i.test(error);
    }
    const candidate = error as { name?: unknown; message?: unknown };
    if (candidate.name === "ChunkLoadError") return true;
    const message = typeof candidate.message === "string" ? candidate.message : "";
    return /Loading (CSS )?chunk .* failed/i.test(message)
        || /Failed to load chunk/i.test(message)
        || /Load chunk .* failed/i.test(message);
}

/**
 * 整页刷新一次以获取最新构建的静态资源。
 * 用 sessionStorage 做 10s 防抖：资源持续 404（如构建仍在进行）时不会无限刷新。
 * sessionStorage 不可用时不做自动刷新，交给错误页的手动刷新按钮。
 */
export function reloadOnceForChunkError(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const lastReloadAt = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || "0");
        if (Number.isFinite(lastReloadAt) && Date.now() - lastReloadAt < RELOAD_GUARD_WINDOW_MS) {
            return false;
        }
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    } catch {
        return false;
    }
    window.location.reload();
    return true;
}
