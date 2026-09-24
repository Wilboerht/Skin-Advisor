/**
 * 收货地址（BFF 代理官网 OAuth 资源端点 /api/oauth/addresses，Bearer 转发）
 * GET  /api/account/addresses - 地址列表（{ success, data: { addresses } }）
 * POST /api/account/addresses - 新增地址（第一条自动默认；上限由官网侧校验）
 */
import type { NextRequest } from "next/server";
import { authorizeAccountBff, proxyOfficialJson, readJsonText, bffError } from "@/lib/account-bff-proxy";

export async function GET(req: NextRequest) {
    const auth = await authorizeAccountBff(req, { scope: "addresses" });
    if (auth.error) return auth.error;
    return proxyOfficialJson({ token: auth.token, path: "/api/oauth/addresses" });
}

export async function POST(req: NextRequest) {
    const auth = await authorizeAccountBff(req, { scope: "addresses-write", maxRequests: 20 });
    if (auth.error) return auth.error;
    const body = await readJsonText(req);
    if (body === null) {
        return bffError("VALIDATION_ERROR", "请求体不是合法的 JSON", 400);
    }
    return proxyOfficialJson({
        token: auth.token,
        path: "/api/oauth/addresses",
        method: "POST",
        body,
    });
}
