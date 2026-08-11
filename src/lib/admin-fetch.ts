/**
 * 管理端统一 fetch 封装
 *
 * 背景：管理端 API 返回 401（会话过期/被撤销）后，各页面若只提示错误，
 * 用户会继续操作并持续失败。此封装统一拦截 401 并跳转 /admin/login。
 *
 * 使用方式与原生 fetch 一致：
 *   const res = await adminFetch("/api/admin/users");
 */

export class AdminUnauthorizedError extends Error {
    constructor() {
        super("Admin session expired");
        this.name = "AdminUnauthorizedError";
    }
}

function redirectToLogin(): void {
    if (typeof window === "undefined") return;
    // 避免在登录页自身请求（如 /api/admin/auth/login 意外 401）上死循环
    if (window.location.pathname.startsWith("/admin/login")) return;
    window.location.href = "/admin/login";
}

/**
 * fetch 包装：响应 401 时跳转登录页并抛出 AdminUnauthorizedError，
 * 阻止调用方继续处理过期会话下的响应。
 */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const res = await fetch(input, init);
    if (res.status === 401) {
        redirectToLogin();
        throw new AdminUnauthorizedError();
    }
    return res;
}
