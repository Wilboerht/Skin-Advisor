"use client"

import { Calendar, Edit, Gift, Loader2, Pause, Play, Plus, Trash2, Users } from "lucide-react"
import {
  CAMPAIGN_STATUS_LABELS,
  type Campaign,
  type CampaignStatus,
} from "@/lib/campaigns"
import { cn } from "@/lib/utils"

interface CampaignListProps {
  campaigns: Campaign[]
  loading: boolean
  statusFilter: CampaignStatus | ""
  onStatusFilterChange: (status: CampaignStatus | "") => void
  onCreate: () => void
  onEdit: (campaign: Campaign) => void
  onDelete: (campaign: Campaign) => void
  onStatusChange: (campaign: Campaign, newStatus: CampaignStatus) => void
  onOpenEntries: (campaign: Campaign) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cls = {
    draft: "bg-gray-100 text-gray-600",
    active: "bg-green-100 text-green-700",
    ended: "bg-slate-100 text-slate-500",
  }[status] ?? "bg-gray-100 text-gray-600"

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cls)}>
      {CAMPAIGN_STATUS_LABELS[status] || status}
    </span>
  )
}

export function CampaignList({
  campaigns,
  loading,
  statusFilter,
  onStatusFilterChange,
  onCreate,
  onEdit,
  onDelete,
  onStatusChange,
  onOpenEntries,
}: CampaignListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">活动管理</h1>
          <p className="text-sm text-[#5E5E5E] mt-1">管理肌智派送好礼活动</p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="campaign-status-filter" className="sr-only">活动状态筛选</label>
          <select
            id="campaign-status-filter"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as CampaignStatus | "")}
            className="px-3 py-2 rounded-lg border border-[#E9E9E7] text-sm bg-white"
          >
            <option value="">全部状态</option>
            {(["draft", "active", "ended"] as CampaignStatus[]).map((s) => (
              <option key={s} value={s}>{CAMPAIGN_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#3D4430] text-white rounded-lg text-sm font-medium hover:bg-[#3D4430]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建活动
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-[#5E5E5E] p-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[#E9E9E7] rounded-2xl">
          <Gift className="w-10 h-10 text-[#8B7355]/30 mx-auto mb-3" />
          <p className="text-sm text-[#5E5E5E]">暂无活动</p>
          <p className="text-xs text-[#5E5E5E]/60 mt-1">点击“创建活动”开始设置肌智派送好礼</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-[#E9E9E7] p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-medium text-[#1A1A1A] truncate">{c.title}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.subtitle && <p className="text-sm text-[#5E5E5E] mb-2">{c.subtitle}</p>}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#5E5E5E]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(c.startDate)} - {formatDate(c.endDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {c._count.entries} 人参与
                    </span>
                    {c.drawDate && (
                      <span className="flex items-center gap-1 text-[#8B7355]">
                        开奖：{formatDate(c.drawDate)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {c.prizes.slice(0, 3).map((p, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F0EDE1] text-[11px] text-[#5E5E5E]"
                      >
                        🎁 {p.name} ×{p.quantity}
                      </span>
                    ))}
                    {c.prizes.length > 3 && (
                      <span className="text-[11px] text-[#5E5E5E]/60">+{c.prizes.length - 3}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.status !== "draft" && (
                    <button
                      type="button"
                      onClick={() => onOpenEntries(c)}
                      aria-label={`查看参与 - ${c.title}`}
                      title="查看参与"
                      className="p-2 rounded-lg text-[#3D4430] hover:bg-[#3D4430]/5 transition-colors"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  )}
                  {c.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => onStatusChange(c, "active")}
                      aria-label={`发布活动 - ${c.title}`}
                      title="发布活动"
                      className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {c.status === "active" && (
                    <button
                      type="button"
                      onClick={() => onStatusChange(c, "ended")}
                      aria-label={`结束活动 - ${c.title}`}
                      title="结束活动"
                      className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                  {c.status !== "active" && (
                    <button
                      type="button"
                      onClick={() => onEdit(c)}
                      aria-label={`编辑 - ${c.title}`}
                      title="编辑"
                      className="p-2 rounded-lg text-[#5E5E5E] hover:bg-gray-50 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(c)}
                    aria-label={`删除 - ${c.title}`}
                    title="删除"
                    className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
