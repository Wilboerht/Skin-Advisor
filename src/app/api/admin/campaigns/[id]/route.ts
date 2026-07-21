import prisma from "@/lib/prisma"
import { withAdminAuth, logAdminAction, getClientInfo } from "@/lib/admin-auth"
import { logger } from "@/lib/logger"
import { campaignUpdateSchema } from "@/lib/campaigns"
import { NextResponse } from "next/server"

// PATCH /api/admin/campaigns/[id] - 更新活动
export const PATCH = withAdminAuth(async (req, { admin, params }) => {
  const { id } = await params
  try {
    const body = await req.json()
    const parsed = campaignUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "参数错误", details: parsed.error.flatten() }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        data[key] = value
      }
    }
    if (data.startDate) data.startDate = new Date(data.startDate as string)
    if (data.endDate) data.endDate = new Date(data.endDate as string)
    if (data.drawDate !== undefined) data.drawDate = data.drawDate ? new Date(data.drawDate as string) : null

    const campaign = await prisma.campaign.update({
      where: { id },
      data,
    })

    // 审计日志
    const clientInfo = getClientInfo(req);
    await logAdminAction({
      adminId: admin.adminId,
      action: "update",
      resource: "Campaign",
      resourceId: id,
      details: { changes: Object.keys(data), status: campaign.status },
      ...clientInfo,
    })

    return NextResponse.json({ campaign })
  } catch (error) {
    logger.error("[Admin Campaigns] Update failed", { error: String(error) })
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
})

// DELETE /api/admin/campaigns/[id] - 删除活动
export const DELETE = withAdminAuth(async (req, { admin, params }) => {

  const { id } = await params
  try {
    await prisma.campaign.delete({ where: { id } })

    // 审计日志
    const clientInfo = getClientInfo(req);
    await logAdminAction({
      adminId: admin.adminId,
      action: "delete",
      resource: "Campaign",
      resourceId: id,
      ...clientInfo,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("[Admin Campaigns] Delete failed", { error: String(error) })
    return NextResponse.json({ error: "删除失败" }, { status: 500 })
  }
})
