import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

/**
 * 内部接口：校验某 sessionId 是否属于指定手机号用户的可见测肤历史。
 * 仅供 NIHPLOD 商城服务端调用（x-internal-key 校验，复用 INTERNAL_API_KEY）。
 * 轻量 count 查询，不受 mp-skin 分页上限约束，任意历史深度均可校验。
 */

const PHONE_RE = /^1[3-9]\d{9}$/;
const SESSION_ID_RE = /^[0-9A-Za-z-]{8,128}$/;

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

export async function GET(request: NextRequest) {
    const internalKey = process.env.INTERNAL_API_KEY;
    const providedKey = request.headers.get("x-internal-key") || "";

    if (!internalKey || !providedKey || !safeCompare(internalKey, providedKey)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
