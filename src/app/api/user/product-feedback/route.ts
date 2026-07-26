import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// POST: 提交产品使用反馈
export async function POST(request: NextRequest) {
    try {
        const user = await getSession();
        if (!user) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        const body = await request.json();
        const { productId, sessionId, rating, skinFeel, effect, repurchase, note } = body;

        // 参数校验
        if (!productId || typeof productId !== "string") {
            return NextResponse.json({ error: "productId 必填" }, { status: 400 });
        }
        if (typeof rating !== "number" || rating < 1 || rating > 5) {
            return NextResponse.json({ error: "rating 必须是 1-5 的整数" }, { status: 400 });
        }

        // 验证产品存在
        const product = await prisma.product.findUnique({
            where: { id: productId, active: true },
        });
        if (!product) {
            return NextResponse.json({ error: "产品不存在" }, { status: 404 });
        }

        // 使用 upsert 防止重复提交（同一用户对同一产品+session 只能评价一次）
        const feedback = await prisma.productFeedback.upsert({
            where: {
                userId_productId_sessionId: {
                    userId: user.id,
                    productId,
                    sessionId: sessionId || "_nosession_",
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
                sessionId: sessionId || null,
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
            { error: "提交反馈失败，请稍后重试" },
            { status: 500 }
        );
    }
}

// GET: 查询产品反馈统计（公开，用于展示平均评分等）
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get("productId");
        const userId = searchParams.get("userId");

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
            { error: "获取反馈失败" },
            { status: 500 }
        );
    }
}
