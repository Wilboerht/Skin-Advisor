/**
 * CSRF 客户端常量
 *
 * 此文件仅包含 cookie/header 名称常量，不依赖任何 Node-only 或加密模块，
 * 可供客户端代码安全导入。
 */

export const CSRF_COOKIE_NAME =
    process.env.NODE_ENV === "production" ? "__Host-csrf_token" : "csrf_token";

export const CSRF_HEADER_NAME = "X-CSRF-Token";
