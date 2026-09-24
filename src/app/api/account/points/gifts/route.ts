/**
 * 积分礼品列表 BFF
 * GET /api/account/points/gifts - 可兑换礼品（代理官网 /api/oauth/points/gifts）
 */
import { NextRequest } from "next/server";
import { authorizeAccountBff, proxyOfficialJson } from "@/lib/account-bff-proxy";

export async function GET(req: NextRequest) {
    const auth = await authorizeAccountBff(req, { scope: "points" });
    if (auth.error) return auth.error;
    return proxyOfficialJson({ token: auth.token, path: "/api/oauth/points/gifts" });
}
