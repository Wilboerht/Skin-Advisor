import prisma from "@/lib/prisma"
import { withAdminAuth, logAdminAction, getClientInfo } from "@/lib/admin-auth"
import { rateLimit, getClientIP } from "@/lib/ratelimit"
import { logger } from "@/lib/logger"
import { parseUserInputDateTime } from "@/lib/time"
import { campaignUpdateSchema } from "@/lib/campaigns"
import { NextResponse } from "next/server"

// PATCH /api/admin/campaigns/[id] - 更新活动
export const PATCH = withAdminAuth(async (req, { admin, params }) => {
  const ip = getClientIP(req);
  const rc = await rateLimit(`admin-campaigns-patch-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
  if (!rc.success) {
    return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
  }
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
    if (data.startDate) {
      // datetime-local 固定按北京时间解析，与创建路径保持一致
      const d = parseUserInputDateTime(data.startDate as string)
      if (!d) return NextResponse.json({ error: "时间格式无效" }, { status: 400 })
      data.startDate = d
    }
    if (data.endDate) {
      const d = parseUserInputDateTime(data.endDate as string)
      if (!d) return NextResponse.json({ error: "时间格式无效" }, { status: 400 })
      data.endDate = d
    }
    if (data.drawDate !== undefined) {
      if (data.drawDate) {
        const d = parseUserInputDateTime(data.drawDate as string)
        if (!d) return NextResponse.json({ error: "时间格式无效" }, { status: 400 })
        data.drawDate = d
      } else {
        data.drawDate = null
      }
    }

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
  const ip = getClientIP(req);
  const rc = await rateLimit(`admin-campaigns-delete-${ip}`, "default", { maxRequests: 20, windowMs: 60 * 1000 });
  if (!rc.success) {
    return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
  }

  const { id } = await params
  try {
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    }
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
