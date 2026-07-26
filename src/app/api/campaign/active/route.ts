import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ISR: 5 分钟缓存
export const revalidate = 300;

/**
 * GET /api/campaign/active
 *
 * 返回当前活跃活动的 endDate 和 title，用于结果页倒计时组件。
 * 公开接口，无敏感数据。
 */
export async function GET() {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        status: "active",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        endDate: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { active: false },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
          },
        }
      );
    }

    return NextResponse.json(
      {
        active: true,
        id: campaign.id,
        title: campaign.title,
        endDate: campaign.endDate.toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("[campaign/active] Failed:", error);
    return NextResponse.json(
      { active: false, error: "Service temporarily unavailable" },
      { status: 500 }
    );
  }
}
