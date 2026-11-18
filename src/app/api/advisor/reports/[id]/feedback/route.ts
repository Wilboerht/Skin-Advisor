import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSessionUser, isSubsiteAccountDisabled } from "@/lib/sso-auth";
import { accountDisabledResponse } from "@/lib/api-response";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const SESSION_ID_RE = /^[0-9A-Za-z-]{8,128}$/;

const FeedbackSchema = z.object({
    targetType: z.enum(["dimension", "finding", "report"]),
    targetKey: z.string().trim().min(1).max(128),
    verdict: z.enum(["accurate", "inaccurate", "unsure"]),
    note: z.string().trim().max(500).optional().nullable(),
});

const TargetSchema = z.object({
    targetType: z.enum(["dimension", "finding", "report"]),
    targetKey: z.string().trim().min(1).max(128),
});

/**
 * 报告纠错：用户对某个维度 / 问题 / 整份报告标记准确度。
 * 仅记录，不直接改分数；供质量看板与 prompt 评估使用。
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            if (await isSubsiteAccountDisabled(request)) return accountDisabledResponse();
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        const ip = getClientIP(request);
        const limit = await rateLimit(`report-feedback-${user.id}-${ip}`, "form", {
            maxRequests: 60,
            windowMs: 60 * 1000,
        });
        if (!limit.success) {
            return NextResponse.json({ error: "提交过于频繁，请稍后再试" }, { status: 429 });
        }

        const { id: sessionId } = await context.params;
        if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
            return NextResponse.json({ error: "缺少报告参数" }, { status: 400 });
        }

        const parsed = FeedbackSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json(
                { error: "参数错误", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const session = await prisma.advisorSession.findFirst({
            where: { sessionId, userId: user.id, completedAt: { not: null }, archivedAt: null },
            select: { sessionId: true },
        });
        if (!session) {
            return NextResponse.json({ error: "报告不存在或无权访问" }, { status: 404 });
        }

        const { targetType, targetKey, verdict, note } = parsed.data;
        // note 显式传入时才覆盖；未传时仅「不准确」保留旧备注，改判为准确/不确定则清空，避免旧原因挂在相反结论上
        const noteUpdate =
            note !== undefined
                ? { note: note || null }
                : verdict === "inaccurate"
                  ? {}
                  : { note: null };
        const feedback = await prisma.reportFeedback.upsert({
            where: {
                userId_sessionId_targetType_targetKey: {
                    userId: user.id,
                    sessionId,
                    targetType,
                    targetKey,
                },
            },
            update: { verdict, ...noteUpdate },
            create: {
                userId: user.id,
                sessionId,
                targetType,
                targetKey,
                verdict,
                note: note || null,
            },
        });

        return NextResponse.json({
            success: true,
            feedback: { id: feedback.id, createdAt: feedback.createdAt },
        });
    } catch (error) {
        logger.error("[reports/feedback] failed", { error: String(error) });
        return NextResponse.json({ error: "提交反馈未成功，请稍后重试" }, { status: 500 });
    }
}

/**
 * 撤销某条维度 / 问题级反馈。
 * 报告级反馈通过再次 POST 改判，不需要撤销。
 */
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            if (await isSubsiteAccountDisabled(request)) return accountDisabledResponse();
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        const ip = getClientIP(request);
        const limit = await rateLimit(`report-feedback-${user.id}-${ip}`, "form", {
            maxRequests: 60,
            windowMs: 60 * 1000,
        });
        if (!limit.success) {
            return NextResponse.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
        }

        const { id: sessionId } = await context.params;
        if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
            return NextResponse.json({ error: "缺少报告参数" }, { status: 400 });
        }

        const searchParams = new URL(request.url).searchParams;
        const parsed = TargetSchema.safeParse({
            targetType: searchParams.get("targetType"),
            targetKey: searchParams.get("targetKey"),
        });
        if (!parsed.success) {
            return NextResponse.json(
                { error: "参数错误", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const session = await prisma.advisorSession.findFirst({
            where: { sessionId, userId: user.id, completedAt: { not: null }, archivedAt: null },
            select: { sessionId: true },
        });
        if (!session) {
            return NextResponse.json({ error: "报告不存在或无权访问" }, { status: 404 });
        }

        const { targetType, targetKey } = parsed.data;
        const result = await prisma.reportFeedback.deleteMany({
            where: { userId: user.id, sessionId, targetType, targetKey },
        });

        return NextResponse.json({ success: true, deleted: result.count });
    } catch (error) {
        logger.error("[reports/feedback] revoke failed", { error: String(error) });
        return NextResponse.json({ error: "撤销反馈未成功，请稍后重试" }, { status: 500 });
    }
}
