import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 全局中间件
 * 部署环境：云服务器（PM2 单实例常驻进程）
 * 注意：此中间件在 Edge Runtime 中运行，不使用 Node.js 原生 API
 */

// 敏感路径前缀列表（需要额外安全检查）
const SENSITIVE_PATHS = ["/api/admin", "/api/cron"];

// 管理员区域公开路径（无需 session 检查）
const ADMIN_PUBLIC_PATHS = [
    "/admin/login",
    "/api/admin/auth/login",
    "/api/admin/setup",
];

// 允许的源（生产环境应限制为实际域名）
const ALLOWED_ORIGINS = [
    process.env.NEXT_PUBLIC_SITE_URL || "",
    process.env.NEXT_PUBLIC_BASE_URL || "",
].filter(Boolean);

/**
 * Edge Runtime 兼容的 Admin Session HMAC 验证
 * 使用 Web Crypto API 替代 Node.js crypto 模块
 */
async function verifyAdminSessionEdge(signedValue: string): Promise<boolean> {
    const separatorIndex = signedValue.lastIndexOf(".");
    if (separatorIndex === -1) return false;

    const data = signedValue.substring(0, separatorIndex);
    const signature = signedValue.substring(separatorIndex + 1);

    // 验证过期时间
    try {
        const parsed = JSON.parse(data);
        if (typeof parsed.exp === "number" && Date.now() > parsed.exp) {
            return false;
        }
    } catch {
        return false;
    }

    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") return false;
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret || "dev-admin-session-secret-change-me");

    try {
        const key = await crypto.subtle.importKey(
            "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        );
        const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
        const expectedSig = Array.from(new Uint8Array(sigBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        // timing-safe comparison
        if (signature.length !== expectedSig.length) return false;
        let result = 0;
        for (let i = 0; i < signature.length; i++) {
            result |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
        }
        return result === 0;
    } catch {
        return false;
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const response = NextResponse.next();

    // ==================== CORS 全局配置 ====================
    const origin = request.headers.get("origin");
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Access-Control-Allow-Credentials", "true");
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Setup-Secret");
    }

    // 预检请求直接返回
    if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: response.headers });
    }

    // ==================== Admin 区域鉴权 ====================
    const isAdminPage = pathname.startsWith("/admin");
    const isAdminApi = pathname.startsWith("/api/admin");
    if ((isAdminPage || isAdminApi) && !ADMIN_PUBLIC_PATHS.some((p) => pathname === p)) {
        const adminSession = request.cookies.get("admin_session")?.value;
        const isValid = adminSession ? await verifyAdminSessionEdge(adminSession) : false;

        if (!isValid) {
            if (isAdminApi) {
                return NextResponse.json(
                    { success: false, error: "Unauthorized" },
                    { status: 401 }
                );
            }
            // Admin page — redirect to login
            return NextResponse.redirect(new URL("/admin/login", request.url));
        }
    }

    // ==================== 敏感路径额外防护 ====================
    const isSensitive = SENSITIVE_PATHS.some((p) => pathname.startsWith(p));
    if (isSensitive) {
        // 1. 禁止直接从公网 IP 访问（如果配置了内部代理，可通过 X-Real-IP 判断）
        const forwardedFor = request.headers.get("x-forwarded-for");
        // 如果未经过反向代理（没有 X-Forwarded-For），且不是本地开发环境，则额外记录
        if (!forwardedFor && process.env.NODE_ENV === "production") {
            // 不阻止，但可在此处增加 IP 白名单逻辑
        }

        // 2. Cron 路径强制要求 Authorization Header
        if (pathname.startsWith("/api/cron")) {
            const authHeader = request.headers.get("authorization");
            const cronSecret = process.env.CRON_SECRET;
            if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
                if (request.nextUrl.searchParams.get("secret") !== cronSecret) {
                    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
                }
            }
        }
    }

    // ==================== 安全响应头（兜底）====================
    // 如果 next.config.ts 中的 headers 未生效，此处作为兜底
    if (!response.headers.has("X-Content-Type-Options")) {
        response.headers.set("X-Content-Type-Options", "nosniff");
    }
    if (!response.headers.has("X-Frame-Options")) {
        response.headers.set("X-Frame-Options", "DENY");
    }

    return response;
}

// 匹配所有路径（排除静态资源）
export const config = {
    matcher: [
        "/api/:path*",
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
    ],
};
