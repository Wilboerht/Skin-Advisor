import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSessionUser, isSubsiteAccountDisabled } from "@/lib/sso-auth";
import { accountDisabledResponse } from "@/lib/api-response";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

const NOSESSION = "_nosession_";

const feedbackSchema = z.object({
    productId: z.string().trim().min(1).max(128),
    sessionId: z.string().trim().max(128).optional().nullable(),
    rating: z.number().int().min(1).max(5),
    skinFeel: z.string().trim().max(100).optional().nullable(),
    effect: z.string().trim().max(100).optional().nullable(),
    repurchase: z.boolean().optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
});

// POST: 提交产品使用反馈
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            if (await isSubsiteAccountDisabled(request)) return accountDisabledResponse();
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        // 按用户限流：此接口此前无任何频控，可被脚本无限刷评分
        const limit = await rateLimit(`product-feedback-${user.id}`, "form", {
            maxRequests: 10,
            windowMs: 60_000,
        });
        if (!limit.success) {
            return NextResponse.json({ error: "提交过于频繁，请稍后再试" }, { status: 429 });
        }

        const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json(
                { error: "参数错误", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }
        const { productId, sessionId, rating, skinFeel, effect, repurchase, note } = parsed.data;

        // 验证产品存在
        const product = await prisma.product.findUnique({
            where: { id: productId, active: true },
        });
        if (!product) {
            return NextResponse.json({ error: "产品不存在" }, { status: 404 });
        }

        // 有 sessionId 时必须属于当前用户且已完成，防止伪造 sessionId 生成无限评价行
        let normalizedSessionId = NOSESSION;
        if (sessionId) {
            const session = await prisma.advisorSession.findFirst({
                where: { sessionId, userId: user.id, completedAt: { not: null } },
                select: { sessionId: true },
            });
            if (!session) {
                return NextResponse.json({ error: "会话不存在或无权使用" }, { status: 403 });
            }
            normalizedSessionId = sessionId;
        }

        // 使用 upsert 防止重复提交（同一用户对同一产品+session 只能评价一次）
        const feedback = await prisma.productFeedback.upsert({
            where: {
                userId_productId_sessionId: {
                    userId: user.id,
                    productId,
                    sessionId: normalizedSessionId,
                },
            },
            update: {
                rating,
                skinFeel: skinFeel || null,
                effect: effect || null,
                repurchase: typeof repurchase === "boolean" ? repurchase : null,
                note: note || null,
            },
            create: {
                userId: user.id,
                productId,
                sessionId: normalizedSessionId,
                rating,
                skinFeel: skinFeel || null,
                effect: effect || null,
                repurchase: typeof repurchase === "boolean" ? repurchase : null,
                note: note || null,
            },
        });

        return NextResponse.json({
            success: true,
            feedback: {
                id: feedback.id,
                rating: feedback.rating,
                createdAt: feedback.createdAt,
            },
        });
    } catch (error) {
        console.error("Failed to submit product feedback:", error);
        return NextResponse.json(
            { error: "提交反馈未成功，请稍后重试" },
            { status: 500 }
        );
    }
}

// GET: 查询产品反馈（productId=公开聚合；userId=需登录且仅限本人）
export async function GET(request: NextRequest) {
    try {
        // 公开聚合接口也做基础防刷，避免被用来放大数据库查询
        const ipLimit = await rateLimit(`product-feedback-get-${getClientIP(request)}`, "default", {
            maxRequests: 60,
            windowMs: 60_000,
        });
        if (!ipLimit.success) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
        }

        const { searchParams } = new URL(request.url);
        const productId = searchParams.get("productId");
        const userId = searchParams.get("userId");

        if ((productId && productId.length > 128) || (userId && userId.length > 128)) {
            return NextResponse.json({ error: "参数过长" }, { status: 400 });
        }

        if (userId) {
            // 查询个人反馈历史需登录且仅限本人
            const user = await getSessionUser(request);
            if (!user) {
                if (await isSubsiteAccountDisabled(request)) return accountDisabledResponse();
                return NextResponse.json({ error: "请先登录" }, { status: 401 });
            }
            if (user.id !== userId) {
                return NextResponse.json({ error: "无权查看他人反馈" }, { status: 403 });
            }
        }

        if (productId) {
            // 查询单个产品的反馈统计
            const [aggregates, recentFeedbacks] = await Promise.all([
                prisma.productFeedback.aggregate({
                    where: { productId },
                    _avg: { rating: true },
                    _count: { rating: true },
                }),
                prisma.productFeedback.findMany({
                    where: { productId },
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        rating: true,
                        skinFeel: true,
                        effect: true,
                        repurchase: true,
                        note: true,
                        createdAt: true,
                    },
                }),
            ]);

            return NextResponse.json({
                productId,
                averageRating: aggregates._avg.rating
                    ? Math.round(aggregates._avg.rating * 10) / 10
                    : null,
                totalReviews: aggregates._count.rating,
                recentFeedbacks,
            });
        }

        if (userId) {
            // 查询用户的反馈列表
            const feedbacks = await prisma.productFeedback.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                take: 50,
            });
            return NextResponse.json({ userId, feedbacks });
        }

        return NextResponse.json({ error: "需提供 productId 或 userId 参数" }, { status: 400 });
    } catch (error) {
        console.error("Failed to fetch product feedback:", error);
        return NextResponse.json(
            { error: "获取反馈未成功" },
            { status: 500 }
        );
    }
}
