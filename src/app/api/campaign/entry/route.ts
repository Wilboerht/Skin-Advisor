import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/sso-auth"
import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { z } from "zod"
import { logger } from "@/lib/logger";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

const entrySchema = z.object({
  campaignId: z.string().min(1),
  shareLink: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
})

// POST /api/campaign/entry - 参与活动
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`campaign-entry-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
    if (!ipLimit.success) {
      return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    const body = await req.json()
    const parsed = entrySchema.safeParse(body)
    if (!parsed.success) {
      return apiError(ErrorCode.VALIDATION_ERROR, "参数错误", 400)
    }

    const { campaignId, shareLink, contactName, contactPhone, contactEmail } = parsed.data

    // 验证活动是否存在且活跃
    const now = new Date()
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        status: "active",
        startDate: { lte: now },
        endDate: { gte: now },
      },
    })

    if (!campaign) {
      return apiError(ErrorCode.NOT_FOUND, "活动不存在或已结束", 404)
    }

    // 获取用户身份（提前验证，事务内不再调 auth）
    const session = await getSessionUser(req)

    if (!session?.id) {
      return apiError("LOGIN_REQUIRED", "请先登录后再参与活动", 401)
    }

    const userId = session.id

    // 检查是否已参与（事务外快速拒绝，事务内再双重确认）
    const existingQuick = await prisma.campaignEntry.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
    })
    if (existingQuick) {
      return apiError("ALREADY_ENTERED", "您已参与本次活动", 409)
    }

    // 生成抽奖码 NPL-XXXXXX（带冲突重试）
    let lotteryCode = ""
    let retries = 0
    while (retries < 5) {
      lotteryCode = `NPL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const existing = await prisma.campaignEntry.findUnique({ where: { lotteryCode } })
      if (!existing) break
      retries++
    }

    // 事务内原子检查人数上限 + 创建记录，防止并发突破 maxEntries
    const entry = await prisma.$transaction(async (tx) => {
      if (campaign.maxEntries > 0) {
        const entryCount = await tx.campaignEntry.count({ where: { campaignId } })
        if (entryCount >= campaign.maxEntries) {
          throw new Error("FULL")
        }
      }
      // 双重确认未参与（事务内再次检查）
      const duplicate = await tx.campaignEntry.findUnique({
        where: { campaignId_userId: { campaignId, userId } },
      })
      if (duplicate) {
        throw new Error("DUPLICATE")
      }
      return tx.campaignEntry.create({
        data: {
          campaignId,
          userId,
          shareLink,
          contactName,
          contactPhone,
          contactEmail,
          lotteryCode,
          status: "pending",
        },
      })
    }).catch((err: Error) => {
      if (err.message === "FULL") {
        return "FULL" as const
      }
      if (err.message === "DUPLICATE") {
        return "DUPLICATE" as const
      }
      throw err
    })

    if (entry === "FULL") {
      return apiError(ErrorCode.VALIDATION_ERROR, "活动参与人数已满", 400)
    }
    if (entry === "DUPLICATE") {
      return apiError("ALREADY_ENTERED", "您已参与本次活动", 409)
    }

    return NextResponse.json({ success: true, entry: { id: entry.id, lotteryCode: entry.lotteryCode, status: entry.status } })
  } catch (error) {
    logger.error("[Campaign Entry] Failed:", error)
    return apiError(ErrorCode.INTERNAL_ERROR, "提交失败，请重试", 500)
  }
}

// GET /api/campaign/entry - 查询用户参与状态
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req);
    const ipLimit = await rateLimit(`campaign-query-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!ipLimit.success) {
      return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
    }

    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get("campaignId")

    if (!campaignId) {
      return apiError(ErrorCode.VALIDATION_ERROR, "缺少活动ID", 400)
    }

    const session = await getSessionUser(req)
    if (!session?.id) {
      return NextResponse.json({ hasEntry: false, entry: null })
    }

    const entry = await prisma.campaignEntry.findUnique({
      where: { campaignId_userId: { campaignId, userId: session.id } },
      select: {
        id: true,
        status: true,
        lotteryCode: true,
        prizeName: true,
        shareLink: true,
        createdAt: true,
        verifiedAt: true,
        reviewNote: true,
      },
    })

    return NextResponse.json({ hasEntry: !!entry, entry })
  } catch (error) {
    logger.error("[Campaign Entry] Failed to fetch:", error)
    return NextResponse.json({ hasEntry: false, entry: null, error: "查询失败" }, { status: 500 })
  }
}
