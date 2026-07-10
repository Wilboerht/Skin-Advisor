import prisma from "@/lib/prisma"
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server"

// GET /api/campaign - 获取当前活跃活动
export async function GET(_req: NextRequest) {
  try {
    const now = new Date()
    const campaign = await prisma.campaign.findFirst({
      where: {
        status: "active",
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { sortOrder: "desc" },
      include: {
        _count: { select: { entries: true } },
      },
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
        maxEntries: campaign.maxEntries,
        entryCount: campaign._count.entries,
        winnerIds: campaign.winnerIds,
      },
    })
  } catch (error) {
    logger.error("[Campaign API] Failed to fetch campaign:", error)
    return NextResponse.json({ campaign: null, error: "获取活动失败" }, { status: 500 })
  }
}
