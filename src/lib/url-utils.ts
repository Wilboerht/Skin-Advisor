/**
 * 校验重定向目标是否为安全的站内路径：
 * - 以 "/" 开头且不以 "//" 开头（防止协议相对 URL 造成的开放重定向）；
 * - 拒绝 "/\..."（WHATWG URL 会把 "/\evil.com" 规范化成 "https://evil.com"，
 *   仅检查 "//" 会漏放）。
 *
 * 规则为全站唯一实现：微信回调 / 微信入口 / session-init / AuthModal 等均引用此处。
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
    if (typeof path !== "string") return false;
    // WHATWG URL 会剥离 tab/换行："/\t/evil.com" 会被解析成 "//evil.com"。
    // 控制字符、反斜杠一律拒绝，再用 URL 解析做最终同源校验。
    if (/[\u0000-\u001F\u007F\\]/.test(path)) return false;
    if (!path.startsWith("/") || path.startsWith("//")) return false;
    try {
        const parsed = new URL(path, "http://internal.local");
        return parsed.origin === "http://internal.local";
    } catch {
        return false;
    }
}
