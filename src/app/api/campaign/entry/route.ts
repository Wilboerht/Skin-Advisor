import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const entrySchema = z.object({
  campaignId: z.string().min(1),
  proofImage: z.string().optional(), // OSS URL
  shareLink: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
})

// POST /api/campaign/entry - 参与活动
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = entrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 })
    }

    const { campaignId, proofImage, shareLink, contactName, contactPhone, contactEmail } = parsed.data

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
      return NextResponse.json({ error: "活动不存在或已结束" }, { status: 404 })
    }

    // 获取用户身份（提前验证，事务内不再调 auth）
    const session = await getSession()

    if (!session?.id) {
      return NextResponse.json({ error: "请先登录后再参与活动", code: "LOGIN_REQUIRED" }, { status: 401 })
    }

    const userId = session.id

    // 检查是否已参与（事务外快速拒绝，事务内再双重确认）
    const existingQuick = await prisma.campaignEntry.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
    })
    if (existingQuick) {
      return NextResponse.json({ error: "您已参与本次活动", code: "ALREADY_ENTERED" }, { status: 409 })
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
          proofImage,
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
      return NextResponse.json({ error: "活动参与人数已满" }, { status: 400 })
    }
    if (entry === "DUPLICATE") {
      return NextResponse.json({ error: "您已参与本次活动", code: "ALREADY_ENTERED" }, { status: 409 })
    }

    return NextResponse.json({ success: true, entry: { id: entry.id, lotteryCode: entry.lotteryCode, status: entry.status } })
  } catch (error) {
    console.error("[Campaign Entry] Failed:", error)
    return NextResponse.json({ error: "提交失败，请重试" }, { status: 500 })
  }
}

// GET /api/campaign/entry - 查询用户参与状态
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get("campaignId")

    if (!campaignId) {
      return NextResponse.json({ error: "缺少活动ID" }, { status: 400 })
    }

    const session = await getSession()
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
        proofImage: true,
        shareLink: true,
        createdAt: true,
        verifiedAt: true,
        reviewNote: true,
      },
    })

    return NextResponse.json({ hasEntry: !!entry, entry })
  } catch (error) {
    console.error("[Campaign Entry] Failed to fetch:", error)
    return NextResponse.json({ hasEntry: false, entry: null, error: "查询失败" }, { status: 500 })
  }
}
