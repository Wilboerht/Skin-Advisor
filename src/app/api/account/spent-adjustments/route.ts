/**
 * 消费补录 BFF（列表 / 提交）
 * GET  /api/account/spent-adjustments - 我的补录申请列表
 * POST /api/account/spent-adjustments - 提交消费补录申请
 *
 * 代理官网 OAuth 资源端点 /api/oauth/spent-adjustments（Bearer 转发），
 * 校验与业务逻辑全部在官网侧，子站不重复实现；复用 account-bff-proxy
 * 统一鉴权/限流/错误归一化。
 */
import { NextRequest } from "next/server";
import {
    authorizeAccountBff,
    proxyOfficialJson,
    readJsonText,
    bffError,
} from "@/lib/account-bff-proxy";

export async function GET(req: NextRequest) {
    const auth = await authorizeAccountBff(req, { scope: "spent" });
    if (auth.error) return auth.error;
    return proxyOfficialJson({ token: auth.token, path: "/api/oauth/spent-adjustments" });
}

export async function POST(req: NextRequest) {
    const auth = await authorizeAccountBff(req, { scope: "spent" });
    if (auth.error) return auth.error;

    // 透传原始 JSON body（校验在官网侧，避免两侧 schema 漂移）
    const body = await readJsonText(req);
    if (body === null) {
        return bffError("INVALID_PARAMS", "请求格式错误", 400);
    }

    return proxyOfficialJson({
        token: auth.token,
        path: "/api/oauth/spent-adjustments",
        method: "POST",
        body,
    });
}
