import { verifyAdminSession } from "@/lib/admin-auth"
import { redirect } from "next/navigation"
import { CampaignsClient } from "@/components/admin/CampaignsClient"

export const dynamic = "force-dynamic"

export default async function CampaignsPage() {
  const admin = await verifyAdminSession()
  if (!admin) redirect("/admin/login")

  return <CampaignsClient />
}
