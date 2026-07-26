import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { z } from "zod";

// 上传内容校验
const uploadSchema = z.object({
  beforeImage: z.string().min(1, "请提供有效的图片路径").optional(),
  afterImage: z.string().min(1, "请提供有效的图片路径").optional(),
  note: z.string().max(1000, "心得不能超过1000字").optional(),
});

/**
 * GET /api/community/posts
 *
 * 公开接口：返回已审核通过的社区内容。
 * 包含两类内容：
 *  1. CampaignEntry（活动审核通过的小红书分享）
 *  2. CommunityPost（用户直接上传的前后对比照）
 *
 * Query: ?page=1&limit=12
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(24, Math.max(1, parseInt(url.searchParams.get("limit") || "12")));
    const skip = (page - 1) * limit;

    // 1. 查询审核通过的 CampaignEntry（带 shareLink 的小红书分享）
    // 注意：XHS 帖子使用独立偏移量，确保分页后不同页看到不同的条目
    const xhsSkip = Math.ceil(skip / 2);
    const xhsTake = Math.ceil(limit / 2);
    const directSkip = skip;
    const directTake = limit;

    const [campaignEntries, campaignTotal] = await Promise.all([
      prisma.campaignEntry.findMany({
        where: {
          status: "verified",
          shareLink: { not: null },
        },
        orderBy: { verifiedAt: "desc" },
        skip: xhsSkip,
        take: xhsTake,
        select: {
          id: true,
          shareLink: true,
          verifiedAt: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
      prisma.campaignEntry.count({
        where: { status: "verified", shareLink: { not: null } },
      }),
    ]);

    // 2. 查询审核通过的 CommunityPost
    const [communityPosts, communityTotal] = await Promise.all([
      prisma.communityPost.findMany({
        where: { status: "approved" },
        orderBy: { createdAt: "desc" },
        skip: directSkip,
        take: directTake,
        select: {
          id: true,
          beforeImage: true,
          afterImage: true,
          note: true,
          personaLabel: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
      prisma.communityPost.count({ where: { status: "approved" } }),
    ]);

    // 3. 合并结果
    const xhsPosts = campaignEntries.map((e) => ({
      type: "xhs" as const,
      id: e.id,
      shareLink: e.shareLink,
      userName: e.user?.name || "匿名用户",
      createdAt: (e.verifiedAt || e.createdAt).toISOString(),
    }));

    const directPosts = communityPosts.map((p) => ({
      type: "direct" as const,
      id: p.id,
      beforeImage: p.beforeImage,
      afterImage: p.afterImage,
      note: p.note,
      personaLabel: p.personaLabel,
      userName: p.user?.name || "匿名用户",
      createdAt: p.createdAt.toISOString(),
    }));

    // 小红书帖子在前，直接上传在后
    const items = [...xhsPosts, ...directPosts];

    return NextResponse.json(
      {
        items,
        pagination: {
          page,
          limit,
          total: campaignTotal + communityTotal,
          totalPages: Math.ceil((campaignTotal + communityTotal) / limit),
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("[community] GET failed:", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/community/posts
 *
 * 需登录：上传前后对比照 + 心得，待审核后展示。
 * 审核通过后自动获得 +1 测试次数奖励。
 */
export async function POST(req: NextRequest) {
  try {
    // 速率限制
    const ip = getClientIP(req);
    const limit = await rateLimit(`community-upload-${ip}`, "default", {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });
    if (!limit.success) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    // 登录验证
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json(
        { error: "请先登录后再分享你的护肤故事" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "参数错误" },
        { status: 400 }
      );
    }

    const { beforeImage, afterImage, note } = parsed.data;

    // 至少需要一张照片
    if (!beforeImage && !afterImage) {
      return NextResponse.json(
        { error: "请至少上传一张照片" },
        { status: 400 }
      );
    }

    // 每人每天最多提交 3 次
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.communityPost.count({
      where: {
        userId: session.id,
        createdAt: { gte: today },
      },
    });
    if (todayCount >= 3) {
      return NextResponse.json(
        { error: "今日提交次数已达上限，请明天再来" },
        { status: 429 }
      );
    }

    // 获取用户派系信息（从最近的测肤 session）
    let personaLabel: string | undefined;
    try {
      const lastSession = await prisma.advisorSession.findFirst({
        where: { userId: session.id, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        select: { analysisResult: true },
      });
      if (lastSession?.analysisResult) {
        const result = lastSession.analysisResult as Record<string, unknown>;
        const skinProfile = result.skinProfile as Record<string, unknown> | undefined;
        const skinType = skinProfile?.type as string | undefined;
        if (skinType) {
          const personaMap: Record<string, string> = {
            sensitive: "敏敏派", dry: "沙漠派", oily: "油条派",
            combination: "混合派", combination_dry: "混合派", combination_oily: "混合派",
            normal: "极简派", unknown: "守护派",
          };
          personaLabel = personaMap[skinType] || undefined;
        }
      }
    } catch {
      // 非关键，降级
    }

    const post = await prisma.communityPost.create({
      data: {
        userId: session.id,
        beforeImage: beforeImage || null,
        afterImage: afterImage || null,
        note: note || null,
        personaLabel,
        status: "pending",
      },
    });

    return NextResponse.json(
      { success: true, post: { id: post.id, status: post.status } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[community] POST failed:", error);
    return NextResponse.json(
      { error: "提交失败，请稍后重试" },
      { status: 500 }
    );
  }
}
