/**
 * SSO 本地 HTTP 开发开关（@nihplod/sso-sdk@1.2.0+ 的 insecureLocalDev）。
 *
 * 浏览器强制要求 __Host-/__Secure- 前缀 Cookie 必须带 Secure 属性，
 * HTTP 本地开发时会直接拒绝写入，症状为「登录回调看似成功但 Cookie
 * 没写进去 → middleware 永远判定未登录 → 无限跳 SSO 授权页」。
 *
 * 开启后：SDK 的 middleware / callback / logout handler 与本项目手写的
 * Cookie（login 入口、me 轮换、sso-auth 读取）统一去除前缀并关闭 Secure。
 * 生产环境无需担心：SDK 在 NODE_ENV=production 且 ssoBaseUrl 为 https 时
 * 会强制忽略该开关（本模块同时也以 NODE_ENV 为条件，生产恒为 false）。
 *
 * ⚠️ proxy.ts / login / callback / logout / sso-auth / me 必须使用同一开关值，
 * 否则 Cookie 名不一致会互相读不到。
 */
export const SSO_INSECURE_LOCAL_DEV = process.env.NODE_ENV !== "production";

/**
 * 站点公网 origin（如 https://advisor.nihplod.cn），所有服务端 302 重定向的跳转基准。
 *
 * Next standalone 部署下 request.url / request.nextUrl.origin 是进程监听地址
 * （如 http://0.0.0.0:3002），用作重定向基准会把浏览器带到不可达地址，
 * 因此一律改用部署时配置的公网地址（与 @nihplod/sso-sdk@1.2.1 的处理一致）。
 *
 * 未配置时返回空字符串，调用方应回退到 req.url（保持本地开发旧行为）。
 */
export function getPublicOrigin(): string {
    const candidate =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXT_PUBLIC_SSO_REDIRECT_URI ||
        "";
    try {
        return new URL(candidate).origin;
    } catch {
        return "";
    }
}
