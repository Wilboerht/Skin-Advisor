import prisma from "@/lib/prisma"
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server"
import { rateLimit, getClientIP } from "@/lib/ratelimit";

// GET /api/campaign - 获取当前活跃活动
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req);
    const limit = await rateLimit(`campaign-ip-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limit.success) {
      return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }
    const now = new Date()
    const campaign = await prisma.campaign.findFirst({
      where: {
        status: "active",
        startDate: { lte: now },
        endDate: { gte: now },
      },
      // 与 gift 页 SSR / campaign/active 保持同向排序，避免多活动并存时 SSR 与 API 选出不同活动
      orderBy: { sortOrder: "asc" },
    })

    if (!campaign) {
      return NextResponse.json({ campaign: null })
    }

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        title: campaign.title,
        subtitle: campaign.subtitle,
        description: campaign.description,
        coverImage: campaign.coverImage,
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
        drawDate: campaign.drawDate?.toISOString() || null,
        prizes: campaign.prizes,
        shareText: campaign.shareText,
        rules: campaign.rules,
      },
    })
  } catch (error) {
    logger.error("[Campaign API] Failed to fetch campaign:", error)
    return NextResponse.json({ campaign: null, error: "获取活动失败" }, { status: 500 })
  }
}
