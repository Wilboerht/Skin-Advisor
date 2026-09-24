/**
 * 积分总览 BFF（积分商城面板用）
 * GET /api/account/points/overview - 积分余额/冻结/最近流水（代理官网 /api/oauth/points）
 *
 * 注意与 /api/account/points（官网内部 HMAC 余额接口，会员卡轻量展示用）区分：
 * 本端点返回积分商城所需的完整视图（frozen/nextReleaseAt/recent）。
 */
import { NextRequest } from "next/server";
import { authorizeAccountBff, proxyOfficialJson } from "@/lib/account-bff-proxy";

export async function GET(req: NextRequest) {
    const auth = await authorizeAccountBff(req, { scope: "points" });
    if (auth.error) return auth.error;
    return proxyOfficialJson({ token: auth.token, path: "/api/oauth/points" });
}
