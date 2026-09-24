/**
 * 消费补录 BFF（凭证图片）
 * GET /api/account/spent-adjustments/image?key=<objectName>
 *
 * 代理官网 OAuth 资源端点 /api/oauth/spent-adjustments/image（Bearer 转发）：
 * 官网完成归属校验后 302 到私有 bucket 短时效签名 URL，这里原样透传重定向，
 * img/链接请求由浏览器跟随到签名地址，签名密钥不进入客户端代码。
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeAccountBff, bffError, normalizeUpstreamError } from "@/lib/account-bff-proxy";
import { OFFICIAL_BASE_URL } from "@/lib/account-bff";
import { logger } from "@/lib/logger";

const UPSTREAM_TIMEOUT_MS = 8000;

export async function GET(req: NextRequest) {
    // 凭证缩略图可能并发加载多张，限流放宽
    const auth = await authorizeAccountBff(req, { scope: "image", maxRequests: 120 });
    if (auth.error) return auth.error;

    const key = req.nextUrl.searchParams.get("key") ?? "";
    if (!key) {
        return bffError("INVALID_PARAMS", "参数错误", 400);
    }

    try {
        const res = await fetch(
            `${OFFICIAL_BASE_URL}/api/oauth/spent-adjustments/image?key=${encodeURIComponent(key)}`,
            {
                headers: { Authorization: `Bearer ${auth.token}` },
                redirect: "manual",
                signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
                cache: "no-store",
            }
        );

        // 官网返回 302 签名地址：透传为子站端点的 302（no-store：签名地址不缓存）
        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get("location");
            if (location) {
                const redirect = NextResponse.redirect(location, 302);
                redirect.headers.set("Cache-Control", "no-store");
                return redirect;
            }
            return bffError("UPSTREAM_ERROR", "图片服务暂时不可用", 502);
        }

        const data = await res.json().catch(() => null);
        return NextResponse.json(normalizeUpstreamError(data, res.status), { status: res.status });
    } catch (err) {
        logger.warn("[account/spent-adjustments/image] 官网不可达", { error: String(err) });
        return bffError("UPSTREAM_ERROR", "图片服务暂时不可用", 502);
    }
}
