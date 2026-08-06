"use client"

import { useState, useEffect, useCallback } from "react"
import { CampaignList } from "./CampaignList"
import { CampaignFormModal } from "./CampaignFormModal"
import { useConfirm } from "@/components/ui/ConfirmModal"
import { useToast } from "@/components/ui/Toast"
import {
  type Campaign,
  type CampaignStatus,
  type PaginatedResponse,
} from "@/lib/campaigns"

const PAGE_LIMIT = 20

export function CampaignsClient() {
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("")

  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      params.set("page", String(page))
      params.set("limit", String(PAGE_LIMIT))
      const res = await fetch(`/api/admin/campaigns?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "加载失败" }))
        throw new Error(data.error || "加载失败")
      }
      const data: PaginatedResponse<Campaign> = await res.json()
      setCampaigns(data.items)
      setTotalPages(data.pagination.totalPages)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载活动列表失败")
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, toast])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleOpenCreate = () => {
    setEditingCampaign(null)
    setShowForm(true)
  }

  const handleOpenEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingCampaign(null)
    fetchCampaigns()
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingCampaign(null)
  }

  const handleDelete = async (campaign: Campaign) => {
    const ok = await confirm({
      title: "删除活动",
      message: `确定要删除活动 "${campaign.title}" 吗？相关参与记录也将被删除。`,
      variant: "danger",
      confirmText: "删除",
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "删除失败" }))
        toast.error(data.error || "删除失败")
        return
      }
      toast.success("活动已删除")
      fetchCampaigns()
    } catch {
      toast.error("删除失败，请重试")
    }
  }

  const handleStatusChange = async (campaign: Campaign, newStatus: CampaignStatus) => {
    if (campaign.status === "draft" && newStatus === "active") {
      const ok = await confirm({
        title: "发布活动",
        message: `确定要发布活动 "${campaign.title}" 吗？发布后活动将对外可见。`,
        variant: "warning",
        confirmText: "发布",
      })
      if (!ok) return
    }

    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "状态更新失败" }))
        toast.error(data.error || "状态更新失败")
        return
      }
      toast.success(
        newStatus === "ended" ? "活动已结束" :
        newStatus === "active" ? "活动已发布" : "状态已更新"
      )
      fetchCampaigns()
    } catch {
      toast.error("状态更新失败，请重试")
    }
  }

  return (
    <div className="space-y-6">
      <CampaignList
        campaigns={campaigns}
        loading={loading}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value)
          setPage(1)
        }}
        onCreate={handleOpenCreate}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-[#E9E9E7] text-sm hover:bg-gray-50 disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-sm text-[#5E5E5E]">
            第 {page} / {totalPages} 页
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-[#E9E9E7] text-sm hover:bg-gray-50 disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}

      <CampaignFormModal
        key={`campaign-form-${showForm ? editingCampaign?.id ?? "new" : "closed"}`}
        isOpen={showForm}
        campaign={editingCampaign}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />

      <ConfirmDialog />
    </div>
  )
}
