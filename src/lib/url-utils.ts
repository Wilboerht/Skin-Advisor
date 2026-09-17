/**
 * 校验重定向目标是否为安全的站内路径：
 * - 以 "/" 开头且不以 "//" 开头（防止协议相对 URL 造成的开放重定向）；
 * - 拒绝 "/\..."（WHATWG URL 会把 "/\evil.com" 规范化成 "https://evil.com"，
 *   仅检查 "//" 会漏放）。
 *
 * 规则为全站唯一实现：微信回调 / 微信入口 / session-init / AuthModal 等均引用此处。
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
    return (
        typeof path === "string" &&
        path.startsWith("/") &&
        !path.startsWith("//") &&
        !path.startsWith("/\\")
    );
}
