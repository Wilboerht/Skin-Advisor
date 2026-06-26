import prisma from "@/lib/prisma"
import { verifyAdminSession } from "@/lib/admin-auth"
import { NextRequest, NextResponse } from "next/server"

// GET /api/admin/campaigns/[id]/entries - 获取活动参与列表
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminSession()
  if (!admin) return NextResponse.json({ error: "未授权" }, { status: 401 })

  const { id } = await params
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const where: Record<string, unknown> = { campaignId: id }
    if (status) where.status = status

    const entries = await prisma.campaignEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, phoneNumber: true } },
      },
    })

    return NextResponse.json({ entries })
  } catch (error) {
    console.error("[Admin Entries] Failed:", error)
    return NextResponse.json({ error: "获取失败" }, { status: 500 })
  }
}

// PATCH /api/admin/campaigns/[id]/entries - 批量审核/设置中奖
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminSession()
  if (!admin) return NextResponse.json({ error: "未授权" }, { status: 401 })

  const { id: campaignId } = await params
  try {
    const { entryId, action, reviewNote, prizeName } = await req.json()

    if (!entryId || !action) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 })
    }

    // 校验 entry 属于当前 campaign
    const existingEntry = await prisma.campaignEntry.findUnique({
      where: { id: entryId },
      select: { campaignId: true },
    })
    if (!existingEntry || existingEntry.campaignId !== campaignId) {
      return NextResponse.json({ error: "参与记录不属于该活动" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      reviewerId: admin.adminId,
    }

    switch (action) {
      case "verify":
        updateData.status = "verified"
        updateData.verifiedAt = new Date()
        updateData.reviewedAt = new Date()
        if (reviewNote) updateData.reviewNote = reviewNote
        break
      case "reject":
        updateData.status = "rejected"
        updateData.reviewedAt = new Date()
        if (reviewNote) updateData.reviewNote = reviewNote
        break
      case "win":
        updateData.status = "won"
        updateData.wonAt = new Date()
        if (prizeName) updateData.prizeName = prizeName
        if (reviewNote) updateData.reviewNote = reviewNote
        break
      case "unwin":
        updateData.status = "verified"
        updateData.wonAt = null
        updateData.prizeName = null
        break
      default:
        return NextResponse.json({ error: "无效操作" }, { status: 400 })
    }

    const entry = await prisma.campaignEntry.update({
      where: { id: entryId },
      data: updateData,
    })

    // 同步更新 Campaign.winnerIds
    if (action === "win" || action === "unwin") {
      const wonEntries = await prisma.campaignEntry.findMany({
        where: { campaignId, status: "won" },
        select: { id: true },
      })
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { winnerIds: wonEntries.map((e) => e.id) },
      })
    }

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("[Admin Entries] Update failed:", error)
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}
