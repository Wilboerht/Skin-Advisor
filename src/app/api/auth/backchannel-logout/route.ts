import { createBackchannelLogoutRouteHandler } from "@nihplod/sso-sdk/next";
import { revokeAllLocalRefreshTokens } from "@/lib/auth";
import { SSO_INSECURE_LOCAL_DEV } from "@/lib/sso-config";
import { logger } from "@/lib/logger";

/**
 * OIDC Backchannel Logout 接收端（服务端到服务端，无浏览器 Cookie）
 *
 * 主站（nihplod.cn，OIDC Provider）在用户全局登出或撤销本站授权时推送：
 *   POST /api/auth/backchannel-logout
 *   Body: application/x-www-form-urlencoded，logout_token=<RS256 JWT>
 *
 * SDK 负责验签（JWKS + iss/aud/exp + events + jti 防重放）并清除本站 SSO Cookie；
 * onLogout 钩子按 sub（主站用户 id，即本地 User.id，见 sso-auth.ts upsertLocalUser）
 * 撤销该用户全部本地 DB refresh token。
 *
 * 远程失效窗口说明：本地 access token（__Host-auth_token）是无状态 JWT，
 * 无法即时撤销，最长存活 30 分钟（见 auth.ts signLocalSession）；之后
 * session-init / CSRF 会话重建会因本地 refresh token 已撤销且 SSO 会话
 * 已在主站失效而无法续期，完成最终登出。
 *
 * 前置条件：在主站管理后台为本 client 注册 backchannelLogoutUri 指向本路由。
 * proxy.ts 已豁免本路径的 SSO 鉴权与 CSRF 校验（参照 profile-webhook）。
 */
export const POST = createBackchannelLogoutRouteHandler({
    clientId: process.env.NEXT_PUBLIC_SSO_CLIENT_ID!,
    ssoBaseUrl: process.env.NEXT_PUBLIC_SSO_BASE_URL!,
    // 本地 HTTP 开发模式：必须与 middleware/callback/logout 保持一致
    insecureLocalDev: SSO_INSECURE_LOCAL_DEV,
    onLogout: async ({ sub }) => {
        // 仅 sid 的 token 无法定位本地用户（本站会话以 sub 为键，不存主站 sid）；
        // 主站签发的 logout_token 恒携带 sub，缺失时记录并视为已处理（返回 200，避免无限重投）
        if (!sub) {
            logger.warn("[backchannel-logout] logout_token 缺少 sub，跳过本地会话清理");
            return;
        }
        try {
            const revoked = await revokeAllLocalRefreshTokens(sub);
            logger.info("[backchannel-logout] 已撤销用户本地 refresh token", { userId: sub, revoked });
        } catch (err) {
            // 记录后重抛：SDK 返回 500，主站按失败重投，避免本地会话静默残留
            logger.error("[backchannel-logout] 撤销本地 refresh token 失败", { userId: sub, error: String(err) });
            throw err;
        }
    },
});
