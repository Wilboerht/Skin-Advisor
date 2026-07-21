"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { CampaignModal } from "./CampaignModal"
import { useToast } from "@/components/ui/Toast"
import {
  CAMPAIGN_ENTRY_STATUSES,
  CAMPAIGN_ENTRY_STATUS_LABELS,
  type Campaign,
  type CampaignEntry,
  type CampaignEntryStatus,
  type PaginatedResponse,
} from "@/lib/campaigns"
import { cn } from "@/lib/utils"

interface CampaignEntriesModalProps {
  isOpen: boolean
  campaign: Campaign | null
  onClose: () => void
  confirm: (options: {
    title: string
    message: string
    variant?: "danger" | "warning" | "default"
    confirmText?: string
  }) => Promise<boolean>
}

const statusBadgeClass: Record<CampaignEntryStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  won: "bg-purple-100 text-purple-700",
}

export function CampaignEntriesModal({ isOpen, campaign, onClose, confirm }: CampaignEntriesModalProps) {
  const toast = useToast()
  const [entries, setEntries] = useState<CampaignEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<CampaignEntryStatus | "">("")
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    if (!campaign) return
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (filter) params.set("status", filter)
      params.set("page", String(page))
      params.set("limit", String(limit))
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/entries?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "获取失败" }))
        throw new Error(data.error || "获取失败")
      }
      const data: PaginatedResponse<CampaignEntry> = await res.json()
      setEntries(data.items)
      setTotalPages(data.pagination.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载参与记录失败")
      toast.error("加载参与记录失败")
    } finally {
      setLoading(false)
    }
  }, [campaign, filter, page, limit, toast])

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchEntries()
    }
  }, [isOpen, filter, page, fetchEntries])

  const handleFilterChange = (value: string) => {
    setFilter(value as CampaignEntryStatus | "")
    setPage(1)
  }

  const handleEntryAction = async (
    entry: CampaignEntry,
    action: "verify" | "reject" | "win" | "unwin"
  ) => {
    if (!campaign) return

    if (action === "win" || action === "unwin") {
      const ok = await confirm({
        title: action === "win" ? "设为中奖" : "取消中奖",
        message: action === "win"
          ? `确定将 "${entry.user?.name || entry.user?.email || "该用户"}" 设为中奖吗？`
          : "确定取消该用户的中奖状态吗？",
        variant: "warning",
        confirmText: "确认",
      })
      if (!ok) return
    }

    setActionLoadingId(entry.id)
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "操作失败" }))
        toast.error(data.error || "操作失败")
        return
      }
      toast.success(
        action === "verify" ? "已通过" :
        action === "reject" ? "已拒绝" :
        action === "win" ? "已设为中奖" : "已取消中奖"
      )
      fetchEntries()
    } catch {
      toast.error("操作失败，请重试")
    } finally {
      setActionLoadingId(null)
    }
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("zh-CN")

  const renderActions = (entry: CampaignEntry) => {
    const isLoading = actionLoadingId === entry.id
    const baseBtn = "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"

    switch (entry.status) {
      case "pending":
        return (
          <>
            <button
              type="button"
              onClick={() => handleEntryAction(entry, "verify")}
              disabled={isLoading}
              className={`${baseBtn} bg-green-50 text-green-600 hover:bg-green-100`}
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "通过"}
            </button>
            <button
              type="button"
              onClick={() => handleEntryAction(entry, "reject")}
              disabled={isLoading}
              className={`${baseBtn} bg-red-50 text-red-500 hover:bg-red-100`}
            >
              拒绝
            </button>
          </>
        )
      case "verified":
        return (
          <button
            type="button"
            onClick={() => handleEntryAction(entry, "win")}
            disabled={isLoading}
            className={`${baseBtn} bg-purple-50 text-purple-600 hover:bg-purple-100`}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "设为中奖"}
          </button>
        )
      case "won":
        return (
          <button
            type="button"
            onClick={() => handleEntryAction(entry, "unwin")}
            disabled={isLoading}
            className={`${baseBtn} bg-gray-50 text-gray-500 hover:bg-gray-100`}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "取消中奖"}
          </button>
        )
      case "rejected":
        return (
          <button
            type="button"
            onClick={() => handleEntryAction(entry, "verify")}
            disabled={isLoading}
            className={`${baseBtn} bg-green-50 text-green-600 hover:bg-green-100`}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "重新通过"}
          </button>
        )
      default:
        return null
    }
  }

  return (
    <CampaignModal
      isOpen={isOpen}
      onClose={onClose}
      title={campaign ? `参与记录 - ${campaign.title}` : "参与记录"}
      maxWidth="4xl"
      titleId="campaign-entries-modal-title"
    >
        <div className="flex items-center gap-3 mb-4">
          <label htmlFor="entries-filter" className="sr-only">状态筛选</label>
          <select
            id="entries-filter"
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E9E9E7] text-sm bg-white/50"
          >
            <option value="">全部状态</option>
            {CAMPAIGN_ENTRY_STATUSES.map((s) => (
              <option key={s} value={s}>{CAMPAIGN_ENTRY_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#5E5E5E]" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-sm text-red-500">{error}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-sm text-[#5E5E5E]">暂无参与记录</div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-[#E9E9E7] bg-white/60"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium text-[#1A1A1A]">
                      {e.user?.name || e.user?.email || e.user?.phoneNumber || "未知用户"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        statusBadgeClass[e.status]
                      )}
                    >
                      {CAMPAIGN_ENTRY_STATUS_LABELS[e.status]}
                    </span>
                    {e.lotteryCode && <span className="text-xs font-mono text-[#5E5E5E]">{e.lotteryCode}</span>}
                    {e.prizeName && <span className="text-xs text-[#8B7355]">🎁 {e.prizeName}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#5E5E5E] flex-wrap">
                    <span>{formatDate(e.createdAt)}</span>
                    {e.shareLink && (
                      <a
                        href={e.shareLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#3D4430] underline"
                      >
                        查看小红书
                      </a>
                    )}
                    {e.contactName && <span>联系人：{e.contactName}</span>}
                    {e.contactPhone && <span>电话：{e.contactPhone}</span>}
                    {e.reviewNote && <span className="text-[#8B7355]">备注：{e.reviewNote}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {renderActions(e)}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              aria-label="上一页"
              className="p-2 rounded-lg border border-[#E9E9E7] hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-[#5E5E5E]">
              第 {page} / {totalPages} 页
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              aria-label="下一页"
              className="p-2 rounded-lg border border-[#E9E9E7] hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </CampaignModal>
  )
}
