import { NextRequest, NextResponse } from "next/server";
import { createCallbackRouteHandler } from "@nihplod/sso-sdk/next";
import { SSO_INSECURE_LOCAL_DEV } from "@/lib/sso-config";

const ssoCallback = createCallbackRouteHandler({
  clientId: process.env.NEXT_PUBLIC_SSO_CLIENT_ID!,
  // Confidential Client：换取 token 必须携带客户端密钥（服务端变量，不进浏览器包）
  clientSecret: process.env.SSO_CLIENT_SECRET,
  ssoBaseUrl: process.env.NEXT_PUBLIC_SSO_BASE_URL!,
  redirectUri: process.env.NEXT_PUBLIC_SSO_REDIRECT_URI!,
  // 本地 HTTP 开发模式：必须与 middleware/logout/login 保持一致
  insecureLocalDev: SSO_INSECURE_LOCAL_DEV,
});

/**
 * SSO OAuth 回调处理器（带本地 Session 引导）。
 *
 * 标准 SSO 回调仅设置 __Host-nihplod_sso_at Cookie（SSO token）。
 * 本地 CSRF 校验依赖本地 JWT Cookie（__Host-auth_token）和 CSRF Cookie（__Host-csrf_token）。
 * 回调成功后引导浏览器先走 /api/auth/session-init，由该端点签发本地 JWT + CSRF session，
 * 然后再跳转到最终目标页面。
 */
export async function GET(req: NextRequest) {
  const response = await ssoCallback(req);

  const location = response.headers.get("location");
  if (location) {
    // 用 URL 解析判断错误态：原 `includes("error=")` 会把合法 query（如 ?return_to=/x?error=0）误判为失败
    let target: URL;
    try {
      target = new URL(location, req.url);
    } catch {
      return response;
    }

    if (!target.searchParams.has("error")) {
      // session-init 仅接受同源相对路径（防开放重定向），绝对 URL 会被丢弃回退到 "/"；
      // 此处规范化为同源相对路径，保留原始 pathname + query
      const requestOrigin = new URL(req.url).origin;
      if (target.origin !== requestOrigin) {
        // 跨域目标不经过 session-init 包装，直接透传 SDK 响应
        return response;
      }

      // 将最终跳转目标作为 return_to 参数，先经过 session-init 引导签发本地 session
      const sessionInitUrl = new URL("/api/auth/session-init", req.url);
      sessionInitUrl.searchParams.set("return_to", target.pathname + target.search);

      const newResponse = NextResponse.redirect(sessionInitUrl);
      // 复制原始响应的 Set-Cookie 头（SSO token cookies），确保浏览器收到
      const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
      for (const h of setCookieHeaders) {
        newResponse.headers.append("Set-Cookie", h);
      }
      return newResponse;
    }
  }

  // 登录失败/取消等场景，直接透传 SDK 响应
  return response;
}
