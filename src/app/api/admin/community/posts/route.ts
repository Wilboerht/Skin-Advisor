import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";
import { z } from "zod";

// 审核操作 schema
const reviewSchema = z.object({
  postId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().max(500).optional(),
});

/**
 * GET /api/admin/community/posts
 *
 * 管理端：查询所有社区帖子（支持按状态筛选 + 分页）
 * Query: ?status=pending&page=1&limit=20
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "请先登录管理后台" }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status;
    }

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.communityPost.count({ where }),
    ]);

    return NextResponse.json({
      items: posts.map((p) => ({
        id: p.id,
        beforeImage: p.beforeImage,
        afterImage: p.afterImage,
        note: p.note,
        personaLabel: p.personaLabel,
        status: p.status,
        reviewNote: p.reviewNote,
        testBonusAwarded: p.testBonusAwarded,
        reviewedAt: p.reviewedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        user: {
          id: p.user.id,
          name: p.user.name || "匿名用户",
          email: p.user.email || null,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[admin/community] GET failed:", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/community/posts
 *
 * 管理端：审核帖子（通过/拒绝）
 * 审核通过时自动发放 +1 测试次数奖励（testBonusAwarded = false 时）
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await verifyAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "请先登录管理后台" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "参数错误" },
        { status: 400 }
      );
    }

    const { postId, action, reviewNote } = parsed.data;

    // 查询帖子
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, status: true, userId: true, testBonusAwarded: true },
    });

    if (!post) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    if (post.status !== "pending") {
      return NextResponse.json(
        { error: `帖子状态为「${post.status}」，无法重复审核` },
        { status: 409 }
      );
    }

    // 审核操作
    if (action === "approve") {
      await prisma.$transaction(async (tx) => {
        // 1. 更新帖子状态
        await tx.communityPost.update({
          where: { id: postId },
          data: {
            status: "approved",
            reviewerId: admin.adminId,
            reviewNote: reviewNote || null,
            reviewedAt: new Date(),
            testBonusAwarded: true,
          },
        });

        // 2. 发放额外测试次数奖励
        await tx.user.update({
          where: { id: post.userId },
          data: {
            dailyTestLimit: { increment: 1 },
          },
        });
      });
    } else {
      // 拒绝
      await prisma.communityPost.update({
        where: { id: postId },
        data: {
          status: "rejected",
          reviewerId: admin.adminId,
          reviewNote: reviewNote || null,
          reviewedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      action,
      testBonusAwarded: action === "approve",
    });
  } catch (error) {
    console.error("[admin/community] PATCH failed:", error);
    return NextResponse.json(
      { error: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
