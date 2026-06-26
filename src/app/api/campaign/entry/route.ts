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

    // 检查参与人数上限
    if (campaign.maxEntries > 0) {
      const entryCount = await prisma.campaignEntry.count({ where: { campaignId } })
      if (entryCount >= campaign.maxEntries) {
        return NextResponse.json({ error: "活动参与人数已满" }, { status: 400 })
      }
    }

    // 获取用户身份
    const session = await getSession()

    if (!session?.id) {
      // 游客不允许参与，需要登录
      return NextResponse.json({ error: "请先登录后再参与活动", code: "LOGIN_REQUIRED" }, { status: 401 })
    }

    const userId = session.id

    // 检查是否已参与
    const existing = await prisma.campaignEntry.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
    })
    if (existing) {
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

    const entry = await prisma.campaignEntry.create({
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
