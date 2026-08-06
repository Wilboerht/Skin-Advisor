/**
 * 微信 OAuth / 官网 Cookie 名称与选项常量
 *
 * 用于微信授权回调与绑定流程中设置官网用户登录态 Cookie。
 * 与官网主站 src/types/auth.ts 保持一致。
 */
export const USER_COOKIE_NAME = "__Host-user_token";
export const USER_REFRESH_COOKIE_NAME = "__Host-user_refresh_token";

export const USER_ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 15 * 60, // 15 分钟
};

export const USER_REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 天
};
