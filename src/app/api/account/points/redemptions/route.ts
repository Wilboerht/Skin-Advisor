/**
 * 兑换记录 BFF
 * GET /api/account/points/redemptions?offset=10 - 我的兑换记录（代理官网同路径端点）
 */
import { NextRequest } from "next/server";
import { authorizeAccountBff, proxyOfficialJson } from "@/lib/account-bff-proxy";

export async function GET(req: NextRequest) {
    const auth = await authorizeAccountBff(req, { scope: "points" });
    if (auth.error) return auth.error;

    const offset = req.nextUrl.searchParams.get("offset");
    const query = offset != null ? `?offset=${encodeURIComponent(offset)}` : "";
    return proxyOfficialJson({ token: auth.token, path: `/api/oauth/points/redemptions${query}` });
}
