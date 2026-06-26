import prisma from "@/lib/prisma"
import { verifyAdminSession } from "@/lib/admin-auth"
import { NextRequest, NextResponse } from "next/server"

// PATCH /api/admin/campaigns/[id] - 更新活动
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminSession()
  if (!admin) return NextResponse.json({ error: "未授权" }, { status: 401 })

  const { id } = await params
  try {
    const body = await req.json()
    const data: Record<string, unknown> = { ...body }

    if (data.startDate) data.startDate = new Date(data.startDate as string)
    if (data.endDate) data.endDate = new Date(data.endDate as string)
    if (data.drawDate) data.drawDate = new Date(data.drawDate as string)
    else if (data.drawDate === null) data.drawDate = null

    const campaign = await prisma.campaign.update({
      where: { id },
      data,
    })

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error("[Admin Campaigns] Update failed:", error)
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}

// DELETE /api/admin/campaigns/[id] - 删除活动
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminSession()
  if (!admin) return NextResponse.json({ error: "未授权" }, { status: 401 })

  const { id } = await params
  try {
    await prisma.campaign.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Admin Campaigns] Delete failed:", error)
    return NextResponse.json({ error: "删除失败" }, { status: 500 })
  }
}
