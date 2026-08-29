/**
 * 校验重定向目标是否为安全的站内路径：
 * 以 "/" 开头且不以 "//" 开头（防止协议相对 URL 造成的开放重定向）。
 * 规则与 src/app/api/auth/wechat/route.ts 的 getSafeRedirect 保持一致。
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
    return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}
