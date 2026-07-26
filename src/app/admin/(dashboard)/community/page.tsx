import { verifyAdminSession } from "@/lib/admin-auth"
import { redirect } from "next/navigation"
import { CommunityReviewClient } from "@/components/admin/CommunityReviewClient"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "社区审核",
}

export default async function CommunityReviewPage() {
  const admin = await verifyAdminSession()
  if (!admin) redirect("/admin/login")

  return <CommunityReviewClient />
}
