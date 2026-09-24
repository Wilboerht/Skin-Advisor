/**
 * 兑换物流轨迹 BFF
 * GET /api/account/points/redemptions/[id]/tracking - 本人兑换记录轨迹（代理官网同路径端点）
 */
import { NextRequest } from "next/server";
import { authorizeAccountBff, proxyOfficialJson } from "@/lib/account-bff-proxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
    const auth = await authorizeAccountBff(req, { scope: "points" });
    if (auth.error) return auth.error;

    const { id } = await context.params;
    return proxyOfficialJson({
        token: auth.token,
        path: `/api/oauth/points/redemptions/${encodeURIComponent(id)}/tracking`,
        timeoutMs: 12000,
    });
}
