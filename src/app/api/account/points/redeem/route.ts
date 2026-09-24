/**
 * 积分兑换 BFF
 * POST /api/account/points/redeem - 兑换礼品（代理官网 /api/oauth/points/redeem，requestId 幂等）
 */
import { NextRequest } from "next/server";
import { authorizeAccountBff, proxyOfficialJson, readJsonText, bffError } from "@/lib/account-bff-proxy";

export async function POST(req: NextRequest) {
    const auth = await authorizeAccountBff(req, { scope: "points-write", maxRequests: 20 });
    if (auth.error) return auth.error;

    const body = await readJsonText(req);
    if (body === null) {
        return bffError("INVALID_PARAMS", "请求格式错误", 400);
    }

    return proxyOfficialJson({
        token: auth.token,
        path: "/api/oauth/points/redeem",
        method: "POST",
        body,
    });
}
