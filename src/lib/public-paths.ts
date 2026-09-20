/**
 * 公开路径清单与判定（proxy.ts 中间件与 auth 回调共用）
 *
 * 支持 "/path/:path*" 后缀通配（匹配该路径及其全部子路径）。
 * 注意：保持与 proxy.ts 中间件的鉴权语义一致——新增页面时只改这里。
 */

export const PUBLIC_PATHS = [
    "/",                       // 首页
    "/login",                  // SSO 登录跳转页
    "/register",               // SSO 注册跳转页
    "/forgot-password",        // 密码重置弹窗页
    "/reset-password",         // 密码重置弹窗页
    "/questions",              // 问卷页（页面公开，实际测肤需登录）
    "/face-scan",              // 面部扫描页（页面公开，实际测肤需登录）
    "/result",                 // 结果页（页面公开，报告数据需登录）
    "/services",               // 顾问服务
    "/faq",                    // FAQ
    "/diary",                  // 护肤档案（游客可浏览页面，趋势/历程 API 仍需登录）
    "/preview/:path*",         // 前端风格预览演示页（myskin 复刻 Demo 用）
    "/profile",                // 我的（游客可预览页面，资料/记录 API 仍需登录）
    "/privacy",                // 隐私政策
    "/terms",                  // 服务条款
    "/robots.txt",
    "/sitemap.xml",
    "/site.webmanifest",       // PWA manifest
    "/llms.txt",               // AI 爬虫说明（robots 中对 GPTBot/CCBot 等 Allow，必须可匿名访问）
    "/llms-full.txt",          // AI 爬虫全量说明
    "/baidu_verify_codeva-NFjTjXquRp.html", // 百度站长 HTML 验证文件
    "/models/:path*",          // face-api 模型文件（静态资源）
    "/api/auth/callback",
    "/api/auth/login",
    "/api/auth/me",
    "/api/auth/logout",
    "/api/auth/session-init",
    "/api/auth/profile-webhook", // 主站资料/会员变更 webhook（服务端到服务端，RS256 JWT 验签，无用户会话）
    "/api/auth/backchannel-logout", // 主站 backchannel logout 推送（服务端到服务端，logout_token 验签，无用户会话）
    "/api/auth/send-code",        // 注册/登录/重置 短信验证码
    "/api/auth/reset-password",   // 密码重置执行
    "/api/auth/wechat",           // 微信 OAuth 初始跳转
    "/api/auth/wechat/bind",      // 微信手机号绑定
    "/api/auth/wechat/callback",  // 微信 OAuth 回调
    "/api/advisor/check-config", // AI 配置检查（公开数据）
    "/api/advisor/questions",  // 问卷题目（公开数据）
    "/api/advisor/test-limit", // 测肤配额预检（游客一律提示登录）
    "/api/advisor/face-analyze", // 面部分析（需登录，受 Origin/Referer 保护）
    "/api/advisor/analyze",    // 肌肤分析（需登录，受 Origin/Referer 保护）
    "/api/advisor/session/status", // 分析状态轮询
    "/api/advisor/analytics/track", // 前端埋点（sendBeacon 无 Cookie）
    "/api/advisor/kf-link",      // 顾问客服链接生成（结果页可用，路由内自带 sessionId 格式校验）
    "/api/internal/:path*",      // 内部 API（旧路由 x-internal-key 鉴权，新路由 Bearer ADVISOR_INTERNAL_SECRET；供企业微信/商城服务端调用）
    "/api/oss/sign",           // 上传签名（扫脸后保存图片）
    "/api/local-upload",       // 本地上传端点
    "/api/products",           // 公开产品列表
    "/api/wechat/webhook",     // 微信回调（无需用户认证）
    "/api/admin/:path*",
    "/admin/:path*",
    "/api/health",
];

/**
 * 判断路径是否公开可匿名访问。
 * "/x/:path*" 匹配 "/x" 本身及其全部子路径（如 "/x/y/z"）。
 */
export function isPublicPath(pathname: string): boolean {
    return PUBLIC_PATHS.some((pattern) => {
        if (pattern.endsWith("/:path*")) {
            const prefix = pattern.slice(0, -"/:path*".length);
            return pathname === prefix || pathname.startsWith(prefix + "/");
        }
        return pathname === pattern;
    });
}
