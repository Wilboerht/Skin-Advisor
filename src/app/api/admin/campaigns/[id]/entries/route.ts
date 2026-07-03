import prisma from "@/lib/prisma"
import { withAdminAuth, logAdminAction, getClientInfo } from "@/lib/admin-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// GET /api/admin/campaigns/[id]/entries - 获取活动参与列表
export const GET = withAdminAuth(async (req, { params }) => {

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
})

const entryPatchSchema = z.object({
  entryId: z.string().min(1),
  action: z.enum(["verify", "reject", "win", "unwin"]),
  reviewNote: z.string().max(2000).optional(),
  prizeName: z.string().max(200).optional(),
})

// PATCH /api/admin/campaigns/[id]/entries - 批量审核/设置中奖
export const PATCH = withAdminAuth(async (req, { admin, params }) => {

  const { id: campaignId } = await params
  try {
    const body = await req.json()
    const parsed = entryPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "参数错误", details: parsed.error.flatten() }, { status: 400 })
    }
    const { entryId, action, reviewNote, prizeName } = parsed.data

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

    // 事务内原子更新 entry 状态 + 同步 winnerIds，防止部分失败
    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.campaignEntry.update({
        where: { id: entryId },
        data: updateData,
      })

      if (action === "win" || action === "unwin") {
        const wonEntries = await tx.campaignEntry.findMany({
          where: { campaignId, status: "won" },
          select: { id: true },
        })
        await tx.campaign.update({
          where: { id: campaignId },
          data: { winnerIds: wonEntries.map((e) => e.id) },
        })
      }
      return updated
    })

    // 审计日志
    const clientInfo = getClientInfo(req);
    await logAdminAction({
      adminId: admin.adminId,
      action,
      resource: "CampaignEntry",
      resourceId: entryId,
      details: { campaignId, prizeName, reviewNote },
      ...clientInfo,
    })

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("[Admin Entries] Update failed:", error)
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
})
