/**
 * 微信 OAuth / 官网 Cookie 名称与选项常量
 *
 * 用于微信授权回调与绑定流程中设置官网用户登录态 Cookie。
 * 与官网主站 src/types/auth.ts 保持一致。
 *
 * 本地 HTTP 开发（SSO_INSECURE_LOCAL_DEV）下与 SSO 全链同一开关：
 * 去除 __Host-/__Secure- 前缀并关闭 Secure（浏览器拒绝 HTTP 下带前缀的
 * Cookie）。读写两侧（callback/bind/logout/wechat-bind 页）必须共用本模块的
 * 常量，切勿散写硬编码 Cookie 名。
 */
import { SSO_INSECURE_LOCAL_DEV } from "@/lib/sso-config";

/** 与 @nihplod/sso-sdk/next 的 toInsecureCookieName 完全一致（避免测试/Node 环境加载 Edge SDK） */
const toInsecureCookieName = (name: string): string => name.replace(/^__(Host|Secure)-/, "");

const cookieName = (name: string): string =>
    SSO_INSECURE_LOCAL_DEV ? toInsecureCookieName(name) : name;

const secure = !SSO_INSECURE_LOCAL_DEV;

export const USER_COOKIE_NAME = cookieName("__Host-user_token");
// 与主站 src/types/auth.ts 保持一致：refresh Cookie 已改名并收窄 Path=/api
//（__Host- 规范强制 Path=/，故放弃前缀；主站部署后旧名 Cookie 成为孤儿，用户最多重新登录一次）
export const USER_REFRESH_COOKIE_NAME = cookieName("nihplod_user_refresh");
/** 微信绑定流程的临时 exchange token Cookie（callback 写入，bind/wechat-bind 页读取） */
export const WECHAT_BIND_COOKIE_NAME = cookieName("__Host-wechat_bind_token");
/**
 * 微信登录流程的浏览器绑定 nonce（子站发起授权时写入，回调消费一次）。
 *
 * 官网侧的 wechat_oauth_nonce 只能绑定官网域名，无法证明「回调 URL 与发起登录的
 * 浏览器是同一个」。子站用本 Cookie 做第二道绑定：攻击者把自己的 exchange token
 * 回调 URL 发给受害者时，受害者浏览器没有对应 Cookie，回调会被拒绝。
 */
export const WECHAT_OAUTH_NONCE_COOKIE_NAME = cookieName("__Host-wechat_oauth_nonce");

export const USER_ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    // 与主站 src/types/auth.ts 保持一致：access token 8 小时（不是 15 分钟）。
    // 旧值 15 分钟会让浏览器提前丢弃仍有效的 token，账户 BFF 频繁触发刷新。
    maxAge: 8 * 60 * 60,
};

export const USER_REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    // 与主站一致：收窄到 /api（读写点全部位于 /api 路由下）
    path: "/api",
    maxAge: 30 * 24 * 60 * 60, // 30 天
};

/** 微信 OAuth 浏览器绑定 nonce：10 分钟有效，仅回调读取一次 */
export const WECHAT_OAUTH_NONCE_COOKIE_OPTIONS = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
};
