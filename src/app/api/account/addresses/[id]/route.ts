/**
 * 收货地址（单条）：编辑 / 删除（BFF 代理官网 /api/oauth/addresses/{id}，Bearer 转发）
 * PATCH  /api/account/addresses/{id} - 编辑地址
 * DELETE /api/account/addresses/{id} - 删除地址（原默认被删时官网侧自动顺延一条默认）
 */
import type { NextRequest } from "next/server";
import { authorizeAccountBff, proxyOfficialJson, readJsonText, bffError } from "@/lib/account-bff-proxy";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const auth = await authorizeAccountBff(req, { scope: "addresses-write", maxRequests: 20 });
    if (auth.error) return auth.error;
    const body = await readJsonText(req);
    if (body === null) {
        return bffError("VALIDATION_ERROR", "请求体不是合法的 JSON", 400);
    }
    return proxyOfficialJson({
        token: auth.token,
        path: `/api/oauth/addresses/${encodeURIComponent(id)}`,
        method: "PATCH",
        body,
    });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const auth = await authorizeAccountBff(req, { scope: "addresses-write", maxRequests: 20 });
    if (auth.error) return auth.error;
    return proxyOfficialJson({
        token: auth.token,
        path: `/api/oauth/addresses/${encodeURIComponent(id)}`,
        method: "DELETE",
    });
}
