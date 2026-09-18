import { NextRequest, NextResponse, after } from "next/server";
import { createLogoutRouteHandler } from "@nihplod/sso-sdk/next";
import { clearLocalSession, revokeLocalRefreshToken } from "@/lib/auth";
import { AUTH_REFRESH_COOKIE_NAME } from "@/lib/auth-config";
import { SSO_INSECURE_LOCAL_DEV, getPublicOrigin } from "@/lib/sso-config";
import {
    USER_COOKIE_NAME,
    USER_REFRESH_COOKIE_NAME,
    USER_ACCESS_COOKIE_OPTIONS,
    USER_REFRESH_COOKIE_OPTIONS,
} from "@/lib/wechat-constants";
import {
    awaitInflightRotation,
    poisonRefreshCache,
    revokeSsoToken,
    REFRESH_TOKEN_COOKIE,
    ACCESS_TOKEN_COOKIE,
} from "@/lib/sso-auth";

const handler = createLogoutRouteHandler({
  clientId: process.env.NEXT_PUBLIC_SSO_CLIENT_ID!,
  // Confidential Client：撤销 refresh_token 必须携带客户端密钥（服务端变量，不进浏览器包）
  clientSecret: process.env.SSO_CLIENT_SECRET,
  ssoBaseUrl: process.env.NEXT_PUBLIC_SSO_BASE_URL!,
  redirectUri: process.env.NEXT_PUBLIC_SSO_REDIRECT_URI!,
  postLogoutRedirectUri: process.env.NEXT_PUBLIC_BASE_URL || "https://advisor.nihplod.cn",
  // 分层退出：默认仅退出本站（local）；global 由请求体 scope 字段经下方翻译为
  // SDK 的 global=1 表单字段触发（redirectToSso 已弃用，勿再使用）
  defaultScope: "local",
  // 服务器间调用（discovery/revoke）的内网地址；未配置时走公网（SDK 默认行为）
  serverBaseUrl: process.env.SSO_SERVER_BASE_URL || undefined,
  // 本地 HTTP 开发模式：必须与 middleware/callback/login 保持一致
  insecureLocalDev: SSO_INSECURE_LOCAL_DEV,
});

// 允许的登出请求源（防 CSRF 登出：恶意页面不得通过 GET 链接/图片强制用户登出）
// getPublicOrigin() 兜底：env 未配置 NEXT_PUBLIC_SITE_URL 时也能匹配配置化公网域名
const ALLOWED_LOGOUT_ORIGINS = [
  getPublicOrigin(),
  process.env.NEXT_PUBLIC_SITE_URL || "",
  process.env.NEXT_PUBLIC_BASE_URL || "",
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3002", "http://127.0.0.1:3002"]
    : []),
].filter(Boolean);

function isSameOriginRequest(req: NextRequest): boolean {
  const candidates = [req.headers.get("origin"), req.headers.get("referer")];
  return candidates.some((value) => {
    if (!value) return false;
    return ALLOWED_LOGOUT_ORIGINS.some((allowed) => {
      if (value === allowed) return true;
      try {
        return new URL(value).origin === allowed;
      } catch {
        return false;
      }
    });
  });
}

/**
 * SSO 登出处理器（同步清除本地 Session Cookie）。
 *
 * SSO SDK 的 createLogoutRouteHandler 仅清除 SSO Cookie
 *（__Host-nihplod_sso_at / __Host-nihplod_sso_rt），
 * 不会触及本地 JWT + CSRF Cookie（__Host-auth_token / __Host-csrf_token）。
 *
 * 若登出后不清除本地 Cookie，CSRF 校验在 Cookie 过期前（最多 30 天）仍会通过，
 * 导致已登出用户的浏览器在共享设备上仍可发起受保护写操作。
 *
 * 因此无论 SSO 登出成功与否，始终同步清除本地 session Cookie。
 *
 * 仅保留 POST：登出是状态变更操作，GET 登出可被恶意站点通过
 * <img>/<link> 等无需用户交互的方式触发（登出型 CSRF）。
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json(
      { error: "Forbidden: cross-origin logout not allowed", code: "FORBIDDEN_ORIGIN" },
      { status: 403 }
    );
  }

  // 退出范围：自家前端以 JSON 提交 { scope: "local" | "global" }（默认 local）。
  // SDK handler 读的是 form-urlencoded 的 global 字段，这里把 scope 翻译成
  // 对应的表单体后构造新请求交给 SDK（无 JSON body / 解析失败一律按 local）
  let scope: "local" | "global" = "local";
  try {
    const body = (await req.clone().json()) as { scope?: unknown };
    if (body?.scope === "global") scope = "global";
  } catch { /* 无 JSON body：按默认 local */ }
  const sdkRequest = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: scope === "global" ? "global=1" : "",
  });

  // 登出与静默轮换的竞态防护：
  // UserProvider 的定时/visibilitychange 刷新会在后台触发 /api/auth/me 的
  // refresh_token 轮换。若轮换与登出并发，轮换响应携带的新 token Set-Cookie
  // 会在登出清理之后落地，把有效会话重新种回浏览器（"退出后过一会儿又自动登录"）。
  // 因此登出前先等待在途轮换拿到新 token，随后一并撤销新 token 并毒化缓存，
  // 让 30 秒内携带旧 refresh token 到达的轮换请求直接失败。
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
  const rotated = refreshToken ? await awaitInflightRotation(refreshToken) : null;

  const response = await handler(sdkRequest);
  // 不论 SSO 登出是否成功，始终清除本地 JWT + CSRF Cookie
  clearLocalSession(response);

  const revocations: Promise<void>[] = [];
  if (refreshToken) {
    poisonRefreshCache(refreshToken);
    if (rotated) {
      revocations.push(revokeSsoToken(rotated.refresh_token, "refresh_token"));
      revocations.push(revokeSsoToken(rotated.access_token, "access_token"));
    }
  }
  // 同时撤销浏览器当前持有的 access token：否则轮换响应若已把新 token
  // 种回 Cookie，未撤销的 access token 在剩余有效期内仍可通过 /api/auth/me 校验
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  if (accessToken) {
    revocations.push(revokeSsoToken(accessToken, "access_token"));
  }
  // 本地 refresh token 同步撤销（原实现只清 Cookie，DB 里哈希长期有效）
  const localRefreshToken = req.cookies.get(AUTH_REFRESH_COOKIE_NAME)?.value ?? null;
  if (localRefreshToken) {
    revocations.push(revokeLocalRefreshToken(localRefreshToken));
  }
  if (revocations.length > 0) {
    // 撤销是尽力而为的清理（revokeSsoToken 内部已 catch），不阻断响应：
    // await 会让登出请求多等若干次子站→主站（经 Cloudflare 回源）的 HTTP 往返，
    // 用户点击退出后长时间无反馈。after() 保证响应发出后继续执行完毕。
    after(() => Promise.allSettled(revocations).then(() => undefined));
  }

  // 微信登录种在子站域名下的官网凭证 Cookie 一并清除
  //（SDK 只清 SSO Cookie，clearLocalSession 只清本地 JWT/CSRF）
  response.cookies.set(USER_COOKIE_NAME, "", { ...USER_ACCESS_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(USER_REFRESH_COOKIE_NAME, "", { ...USER_REFRESH_COOKIE_OPTIONS, maxAge: 0 });

  // SDK 的 global 分支返回 307（RP-Initiated Logout 指向主站 end-session），
  // local 分支返回 307 回本站首页。
  // 前端以 fetch 调用时跨域跳转不会真正执行主站登出（主站 /logout 是交互确认页，
  // fetch 不执行页面 JS；且 credentials: same-origin 下跨域 Cookie 不发送/不落地），
  // 因此两种分支都改写为 200 JSON 并保留所有清 Cookie 头：
  // - global：{ ssoLogoutUrl }，前端整页跳转主站 end-session
  // - local：{ ok: true }，前端跳回本站首页即可
  const ssoLogoutUrl = scope === "global" ? response.headers.get("location") : null;
  if (ssoLogoutUrl) {
    const json = NextResponse.json({ success: true, ssoLogoutUrl });
    for (const h of response.headers.getSetCookie?.() ?? []) {
      json.headers.append("Set-Cookie", h);
    }
    return json;
  }

  const localJson = NextResponse.json({ ok: true });
  for (const h of response.headers.getSetCookie?.() ?? []) {
    localJson.headers.append("Set-Cookie", h);
  }
  return localJson;
}
