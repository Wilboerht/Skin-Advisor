import { NextRequest, NextResponse } from "next/server";
import { guardInternalUserRequest } from "@/lib/internal-guard";
import {
    DiaryValidationError,
    deleteDiaryEntry,
    getDiaryList,
    upsertDiaryEntry,
} from "@/lib/diary-service";
import { logger } from "@/lib/logger";

export const maxDuration = 15;

/**
 * 内部接口：护肤档案日记读写（供主站官网用户中心「护肤档案」调用）
 *
 * 鉴权：HMAC 签名（X-Internal-API-*，project=advisor），兼容旧版 Bearer；
 * 限流按作用域 + userId；写入额外要求 `?userId=`（签名只覆盖 pathname）。
 *
 * GET    /api/internal/diary?userId=&month=YYYY-MM
 *        /api/internal/diary?userId=&before=YYYY-MM-DD&limit=&offset=
 * POST   /api/internal/diary?userId=   body { date, skinState, tags, note }
 *        → { success, data: entry, isFirstManualCheckin, streak?, points? }
 *        points 为"应发积分"，由官网积分账本直发（reference=checkin:{userId}:{date}
 *        幂等）；子站内部路径不发放，避免与官网重复。
 * DELETE /api/internal/diary?userId=&date=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
    const guard = await guardInternalUserRequest(request, { scope: "diary-read" });
    if (guard.error) return guard.error;

    try {
        const { searchParams } = new URL(request.url);
        const list = await getDiaryList(guard.userId, {
            month: searchParams.get("month"),
            before: searchParams.get("before"),
            offset: Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0),
            limit: searchParams.get("limit"),
        });
        return NextResponse.json({
            success: true,
            data: list.entries,
            pagination: list.pagination,
        });
    } catch (error) {
        logger.error("[internal/diary] fetch failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    // 先读原始文本再验签：HMAC 签名包含请求体哈希（官方出站签名同口径）
    const rawBody = await request.text();
    const guard = await guardInternalUserRequest(request, {
        scope: "diary-write",
        maxRequests: 10,
        rawBody,
    });
    if (guard.error) return guard.error;

    try {
        let body: unknown = null;
        try {
            body = rawBody ? JSON.parse(rawBody) : null;
        } catch {
            body = null;
        }
        const result = await upsertDiaryEntry(guard.userId, body);
        return NextResponse.json({
            success: true,
            data: result.entry,
            isFirstManualCheckin: result.isFirstManualCheckin,
            ...(result.streak ? { streak: result.streak } : {}),
            ...(result.points ? { points: result.points } : {}),
        });
    } catch (error) {
        if (error instanceof DiaryValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        logger.error("[internal/diary] save failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const guard = await guardInternalUserRequest(request, { scope: "diary-write", maxRequests: 10 });
    if (guard.error) return guard.error;

    try {
        const { searchParams } = new URL(request.url);
        const deleted = await deleteDiaryEntry(guard.userId, searchParams.get("date"));
        return NextResponse.json({ success: true, deleted });
    } catch (error) {
        if (error instanceof DiaryValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        logger.error("[internal/diary] delete failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
