import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { logger } from "@/lib/logger";

/**
 * 内部接口：校验某 sessionId 是否属于指定手机号用户的可见测肤历史。
 * 仅供 NIHPLOD 商城服务端调用。
 * 鉴权：优先 HMAC 签名（X-Internal-API-*），过渡期兼容旧版 x-internal-key。
 * 轻量 count 查询，不受 mp-skin 分页上限约束，任意历史深度均可校验。
 */

const PHONE_RE = /^1[3-9]\d{9}$/;
const SESSION_ID_RE = /^[0-9A-Za-z-]{8,128}$/;

export async function GET(request: NextRequest) {
    const auth = await authorizeInternalRequest(request, { legacy: "x-internal-key" });
    if (!auth.ok) {
        return NextResponse.json({ error: "Unauthorized" }, { status: auth.status ?? 401 });
    }

    const phone = request.nextUrl.searchParams.get("phone") || "";
    const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
    if (!PHONE_RE.test(phone) || !SESSION_ID_RE.test(sessionId)) {
        return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    // IP 级宽松兜底，防止密钥泄漏后被批量扫描
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`internal-session-ownership-${ip}`, "default", { maxRequests: 120, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { phoneNumber: phone },
            select: { id: true },
        });

        if (!user) {
            return NextResponse.json({ owned: false });
        }

        const count = await prisma.advisorSession.count({
            where: {
                userId: user.id,
                sessionId,
                completedAt: { not: null },
                archivedAt: null, // 冷层归档摘要对用户不可见
            },
        });

        return NextResponse.json({ owned: count > 0 });
    } catch (error) {
        logger.error("session-ownership failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
