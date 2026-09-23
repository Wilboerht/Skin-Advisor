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
import { toInsecureCookieName } from "@nihplod/sso-sdk/next";
import { SSO_INSECURE_LOCAL_DEV } from "@/lib/sso-config";

const cookieName = (name: string): string =>
    SSO_INSECURE_LOCAL_DEV ? toInsecureCookieName(name) : name;

const secure = !SSO_INSECURE_LOCAL_DEV;

export const USER_COOKIE_NAME = cookieName("__Host-user_token");
export const USER_REFRESH_COOKIE_NAME = cookieName("__Host-user_refresh_token");
/** 微信绑定流程的临时 exchange token Cookie（callback 写入，bind/wechat-bind 页读取） */
export const WECHAT_BIND_COOKIE_NAME = cookieName("__Host-wechat_bind_token");

export const USER_ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 15 * 60, // 15 分钟
};

export const USER_REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 天
};
