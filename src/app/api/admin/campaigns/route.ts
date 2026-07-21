import prisma from "@/lib/prisma"
import { withAdminAuth, logAdminAction, getClientInfo } from "@/lib/admin-auth"
import { logger } from "@/lib/logger"
import { NextResponse } from "next/server"
import {
  campaignCreateSchema,
  campaignQuerySchema,
  type Campaign,
} from "@/lib/campaigns"

// GET /api/admin/campaigns - 获取活动列表（分页）
export const GET = withAdminAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url)
    const parsed = campaignQuerySchema.parse({
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    })
    const { status, page, limit } = parsed
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { sortOrder: "desc" },
        skip,
        take: limit,
        include: { _count: { select: { entries: true } } },
      }),
      prisma.campaign.count({ where }),
    ])

    const serialized = campaigns.map((c) => ({
      ...c,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate.toISOString(),
      drawDate: c.drawDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))

    return NextResponse.json({
      items: serialized as unknown as Campaign[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    logger.error("[Admin Campaigns] List failed", { error: String(error) })
    return NextResponse.json({ error: "获取失败" }, { status: 500 })
  }
})

// POST /api/admin/campaigns - 创建活动
export const POST = withAdminAuth(async (req, { admin }) => {
  try {
    const body = await req.json()
    const parsed = campaignCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "参数错误", details: parsed.error.flatten() }, { status: 400 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        ...parsed.data,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        drawDate: parsed.data.drawDate ? new Date(parsed.data.drawDate) : null,
        prizes: parsed.data.prizes,
      },
    })

    // 审计日志
    const clientInfo = getClientInfo(req);
    await logAdminAction({
      adminId: admin.adminId,
      action: "create",
      resource: "Campaign",
      resourceId: campaign.id,
      details: { title: campaign.title, status: campaign.status },
      ...clientInfo,
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    logger.error("[Admin Campaigns] Create failed", { error: String(error) })
    return NextResponse.json({ error: "创建失败" }, { status: 500 })
  }
})
