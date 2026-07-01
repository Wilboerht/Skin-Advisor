"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Edit, Trash2, Play, Pause, CheckCircle2, Loader2, AlertCircle, Gift, Calendar, Users, Eye } from "lucide-react"

interface Prize {
  name: string
  image?: string
  quantity: number
  description?: string
}

interface Campaign {
  id: string
  title: string
  subtitle: string | null
  status: string
  startDate: string
  endDate: string
  drawDate: string | null
  prizes: Prize[]
  shareText: string | null
  rules: string | null
  maxEntries: number
  sortOrder: number
  _count: { entries: number }
}

export function CampaignsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  // Entries view
  const [showEntries, setShowEntries] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [entries, setEntries] = useState<Array<{
    id: string; status: string; lotteryCode: string | null; prizeName: string | null;
    shareLink: string | null; proofImage: string | null;
    contactName: string | null; contactPhone: string | null;
    reviewNote: string | null; createdAt: string;
    user: { id: string; name: string | null; email: string | null; phoneNumber: string | null } | null;
  }>>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [entriesFilter, setEntriesFilter] = useState("")
  const [entryActionLoading, setEntryActionLoading] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [drawDate, setDrawDate] = useState("")
  const [prizesJson, setPrizesJson] = useState('[{"name":"NIHPLOD 精华液","quantity":3}]')
  const [shareText, setShareText] = useState("")
  const [rules, setRules] = useState("")
  const [maxEntries, setMaxEntries] = useState(0)
  const [sortOrder, setSortOrder] = useState(0)

  const fetchEntries = useCallback(async (campaignId: string, statusFilter?: string) => {
    setEntriesLoading(true)
    try {
      const url = `/api/admin/campaigns/${campaignId}/entries${statusFilter ? `?status=${statusFilter}` : ""}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.entries) setEntries(data.entries)
    } catch {
      // silently fail
    } finally {
      setEntriesLoading(false)
    }
  }, [])

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/campaigns")
      const data = await res.json()
      if (data.campaigns) setCampaigns(data.campaigns)
    } catch {
      setError("加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const resetForm = () => {
    setTitle("")
    setSubtitle("")
    setStartDate("")
    setEndDate("")
    setDrawDate("")
    setPrizesJson('[{"name":"NIHPLOD 精华液","quantity":3}]')
    setShareText("")
    setRules("")
    setMaxEntries(0)
    setSortOrder(0)
    setEditingId(null)
  }

  const openCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (c: Campaign) => {
    setTitle(c.title)
    setSubtitle(c.subtitle || "")
    setStartDate(new Date(c.startDate).toISOString().slice(0, 16))
    setEndDate(new Date(c.endDate).toISOString().slice(0, 16))
    setDrawDate(c.drawDate ? new Date(c.drawDate).toISOString().slice(0, 16) : "")
    setPrizesJson(JSON.stringify(c.prizes, null, 2))
    setShareText(c.shareText || "")
    setRules(c.rules || "")
    setMaxEntries(c.maxEntries)
    setSortOrder(c.sortOrder)
    setEditingId(c.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError("")
    try {
      let prizes: Prize[]
      try {
        prizes = JSON.parse(prizesJson)
        if (!Array.isArray(prizes)) throw new Error("奖品格式错误")
      } catch {
        setSaveError("奖品 JSON 格式错误")
        setSaving(false)
        return
      }

      const body: Record<string, unknown> = {
        title,
        subtitle: subtitle || undefined,
        startDate,
        endDate,
        drawDate: drawDate || undefined,
        prizes,
        shareText: shareText || undefined,
        rules: rules || undefined,
        maxEntries,
        sortOrder,
      }
      // 仅新建时设置草稿状态，编辑时保留原状态
      if (!editingId) {
        body.status = "draft"
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/admin/campaigns/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch("/api/admin/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error || "保存失败")
        return
      }

      setShowForm(false)
      resetForm()
      fetchCampaigns()
    } catch {
      setSaveError("网络错误")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此活动？相关参与记录也将被删除。")) return
    try {
      await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" })
      fetchCampaigns()
    } catch {
      setError("删除失败")
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/admin/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      fetchCampaigns()
    } catch {
      setError("状态更新失败")
    }
  }

  const handleEntryAction = async (entryId: string, action: "verify" | "reject" | "win" | "unwin", prizeName?: string) => {
    if (!selectedCampaign) return
    setEntryActionLoading(entryId)
    try {
      const res = await fetch(`/api/admin/campaigns/${selectedCampaign.id}/entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, action, prizeName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "操作失败")
        return
      }
      fetchEntries(selectedCampaign.id, entriesFilter)
    } catch {
      setError("操作失败，请重试")
    } finally {
      setEntryActionLoading(null)
    }
  }

  const openEntries = (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setShowEntries(true)
    setEntriesFilter("")
    fetchEntries(campaign.id)
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      draft: { label: "草稿", cls: "bg-gray-100 text-gray-600" },
      active: { label: "进行中", cls: "bg-green-100 text-green-700" },
      ended: { label: "已结束", cls: "bg-slate-100 text-slate-500" },
    }
    const s = map[status] || { label: status, cls: "bg-gray-100" }
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">活动管理</h1>
          <p className="text-sm text-[#5E5E5E] mt-1">管理肌智派送好礼活动</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#3D4430] text-white rounded-lg text-sm font-medium hover:bg-[#3D4430]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          创建活动
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm mb-4">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Campaign List */}
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-[#5E5E5E] p-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[#E9E9E7] rounded-2xl">
          <Gift className="w-10 h-10 text-[#8B7355]/30 mx-auto mb-3" />
          <p className="text-sm text-[#5E5E5E]">暂无活动</p>
          <p className="text-xs text-[#5E5E5E]/60 mt-1">点击"创建活动"开始设置肌智派送好礼</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-[#E9E9E7] p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-medium text-[#1A1A1A] truncate">{c.title}</h3>
                    {statusBadge(c.status)}
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
                    {(c.prizes as Prize[]).slice(0, 3).map((p, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F0EDE1] text-[11px] text-[#5E5E5E]">
                        🎁 {p.name} ×{p.quantity}
                      </span>
                    ))}
                    {(c.prizes as Prize[]).length > 3 && (
                      <span className="text-[11px] text-[#5E5E5E]/60">+{(c.prizes as Prize[]).length - 3}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.status !== "draft" && (
                    <button
                      onClick={() => openEntries(c)}
                      title="查看参与"
                      className="p-2 rounded-lg text-[#3D4430] hover:bg-[#3D4430]/5 transition-colors"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  )}
                  {c.status === "draft" && (
                    <button
                      onClick={() => handleStatusChange(c.id, "active")}
                      title="发布活动"
                      className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {c.status === "active" && (
                    <button
                      onClick={() => handleStatusChange(c.id, "ended")}
                      title="结束活动"
                      className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                  {c.status !== "active" && (
                    <button
                      onClick={() => openEdit(c)}
                      title="编辑"
                      className="p-2 rounded-lg text-[#5E5E5E] hover:bg-gray-50 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(c.id)}
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

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-6">
              {editingId ? "编辑活动" : "创建活动"}
            </h2>

            {saveError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm mb-4">
                <AlertCircle className="w-4 h-4" />
                {saveError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#5E5E5E] mb-1">活动标题 *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：六月肌智派好礼"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5E5E5E] mb-1">副标题</label>
                <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="可选副标题"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#5E5E5E] mb-1">开始时间 *</label>
                  <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5E5E5E] mb-1">结束时间 *</label>
                  <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5E5E5E] mb-1">开奖时间</label>
                <input type="datetime-local" value={drawDate} onChange={(e) => setDrawDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5E5E5E] mb-1">奖品列表 (JSON) *</label>
                <textarea value={prizesJson} onChange={(e) => setPrizesJson(e.target.value)} rows={6}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm font-mono focus:outline-none focus:border-[#3D4430]/40"
                  placeholder='[{"name":"奖品名","image":"https://...","quantity":3,"description":"描述"}]' />
                <p className="text-[10px] text-[#5E5E5E]/60 mt-1">
                  JSON 数组格式：name(名称), image(图片URL可选), quantity(数量), description(描述可选)
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5E5E5E] mb-1">小红书分享文案</label>
                <textarea value={shareText} onChange={(e) => setShareText(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
                  placeholder="支持 &#123;&#123;nickname&#125;&#125; 占位符" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5E5E5E] mb-1">活动规则 (Markdown)</label>
                <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={4}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
                  placeholder="活动规则说明（可选，支持 Markdown）" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#5E5E5E] mb-1">参与上限 (0=不限)</label>
                  <input type="number" value={maxEntries} onChange={(e) => setMaxEntries(Number(e.target.value))} min={0}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5E5E5E] mb-1">排序权重</label>
                  <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[#E9E9E7]">
              <button
                onClick={() => { setShowForm(false); resetForm() }}
                className="px-5 py-2.5 rounded-lg text-sm text-[#5E5E5E] hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !startDate || !endDate}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3D4430] text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#3D4430]/90 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {editingId ? "保存修改" : "创建活动"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entries Modal */}
      {showEntries && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowEntries(false)} />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A1A1A]">参与记录 - {selectedCampaign.title}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <select
                    value={entriesFilter}
                    onChange={(e) => {
                      setEntriesFilter(e.target.value)
                      fetchEntries(selectedCampaign.id, e.target.value)
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#E9E9E7] text-sm"
                  >
                    <option value="">全部状态</option>
                    <option value="pending">待审核</option>
                    <option value="verified">已通过</option>
                    <option value="rejected">未通过</option>
                    <option value="won">已中奖</option>
                  </select>
                </div>
              </div>
              <button onClick={() => setShowEntries(false)} className="p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {entriesLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#5E5E5E]" /></div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-sm text-[#5E5E5E]">暂无参与记录</div>
            ) : (
              <div className="space-y-2">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-4 p-4 rounded-xl border border-[#E9E9E7] bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[#1A1A1A]">
                          {e.user?.name || e.user?.email || e.user?.phoneNumber || "未知用户"}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          { pending: "bg-amber-100 text-amber-700", verified: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700", won: "bg-purple-100 text-purple-700" }[e.status] || "bg-gray-100 text-gray-600"
                        }`}>
                          {{ pending: "待审核", verified: "已通过", rejected: "未通过", won: "已中奖" }[e.status] || e.status}
                        </span>
                        {e.lotteryCode && <span className="text-xs font-mono text-[#5E5E5E]">{e.lotteryCode}</span>}
                        {e.prizeName && <span className="text-xs text-[#8B7355]">🎁 {e.prizeName}</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#5E5E5E]">
                        <span>{new Date(e.createdAt).toLocaleDateString("zh-CN")}</span>
                        {e.shareLink && (
                          <a href={e.shareLink} target="_blank" rel="noopener noreferrer" className="text-[#3D4430] underline">查看小红书</a>
                        )}
                        {e.contactName && <span>联系人：{e.contactName}</span>}
                        {e.contactPhone && <span>电话：{e.contactPhone}</span>}
                        {e.reviewNote && <span className="text-[#8B7355]">备注：{e.reviewNote}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {e.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleEntryAction(e.id, "verify")}
                            disabled={entryActionLoading === e.id}
                            className="px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-xs font-medium hover:bg-green-100 transition-colors"
                          >
                            {entryActionLoading === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "通过"}
                          </button>
                          <button
                            onClick={() => handleEntryAction(e.id, "reject")}
                            disabled={entryActionLoading === e.id}
                            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 transition-colors"
                          >
                            拒绝
                          </button>
                        </>
                      )}
                      {e.status === "verified" && (
                        <button
                          onClick={() => handleEntryAction(e.id, "win")}
                          disabled={entryActionLoading === e.id}
                          className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 text-xs font-medium hover:bg-purple-100 transition-colors"
                        >
                          设为中奖
                        </button>
                      )}
                      {e.status === "won" && (
                        <button
                          onClick={() => handleEntryAction(e.id, "unwin")}
                          disabled={entryActionLoading === e.id}
                          className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 text-xs font-medium hover:bg-gray-100 transition-colors"
                        >
                          取消中奖
                        </button>
                      )}
                      {e.status === "rejected" && (
                        <button
                          onClick={() => handleEntryAction(e.id, "verify")}
                          disabled={entryActionLoading === e.id}
                          className="px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-xs font-medium hover:bg-green-100 transition-colors"
                        >
                          重新通过
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
