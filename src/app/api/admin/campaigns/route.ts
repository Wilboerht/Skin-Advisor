import prisma from "@/lib/prisma"
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

// GET /api/admin/campaigns - 获取所有活动
export async function GET(_req: NextRequest) {
  const admin = await verifyAdminSession()
  if (!admin) return NextResponse.json({ error: "未授权" }, { status: 401 })

  const campaigns = await prisma.campaign.findMany({
    orderBy: { sortOrder: "desc" },
    include: { _count: { select: { entries: true } } },
  })

  return NextResponse.json({ campaigns })
}

const createSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  drawDate: z.string().optional(),
  prizes: z.array(z.object({
    name: z.string(),
    image: z.string().optional(),
    quantity: z.number().min(1),
    description: z.string().optional(),
  })),
  shareText: z.string().optional(),
  rules: z.string().optional(),
  maxEntries: z.number().min(0).default(0),
  sortOrder: z.number().default(0),
  status: z.enum(["draft", "active", "ended"]).default("draft"),
})

// POST /api/admin/campaigns - 创建活动
export async function POST(req: NextRequest) {
  const admin = await verifyAdminSession()
  if (!admin) return NextResponse.json({ error: "未授权" }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
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
    console.error("[Admin Campaigns] Create failed:", error)
    return NextResponse.json({ error: "创建失败" }, { status: 500 })
  }
}
