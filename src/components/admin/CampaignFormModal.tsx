"use client"

import { useState, useCallback } from "react"
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react"
import { CampaignModal } from "./CampaignModal"
import { useToast } from "@/components/ui/Toast"
import {
  campaignCreateSchema,
  type Campaign,
  type Prize,
  toISOLocalString,
} from "@/lib/campaigns"
import { cn } from "@/lib/utils"

interface CampaignFormModalProps {
  isOpen: boolean
  campaign?: Campaign | null
  onClose: () => void
  onSuccess: () => void
}

type FormErrors = Partial<Record<keyof CampaignFormData | "prizes" | "general", string>>

interface CampaignFormData {
  title: string
  subtitle: string
  startDate: string
  endDate: string
  drawDate: string
  prizes: Prize[]
  shareText: string
  rules: string
  maxEntries: number
  sortOrder: number
}

const emptyPrize: Prize = { name: "", quantity: 1, image: "", description: "" }

function getInitialFormData(campaign?: Campaign | null): CampaignFormData {
  if (campaign) {
    return {
      title: campaign.title,
      subtitle: campaign.subtitle || "",
      startDate: toISOLocalString(new Date(campaign.startDate)),
      endDate: toISOLocalString(new Date(campaign.endDate)),
      drawDate: campaign.drawDate ? toISOLocalString(new Date(campaign.drawDate)) : "",
      prizes: campaign.prizes.length ? campaign.prizes : [{ ...emptyPrize }],
      shareText: campaign.shareText || "",
      rules: campaign.rules || "",
      maxEntries: campaign.maxEntries,
      sortOrder: campaign.sortOrder,
    }
  }
  return {
    title: "",
    subtitle: "",
    startDate: "",
    endDate: "",
    drawDate: "",
    prizes: [{ ...emptyPrize }],
    shareText: "",
    rules: "",
    maxEntries: 0,
    sortOrder: 0,
  }
}

function validateForm(data: CampaignFormData): FormErrors {
  const errors: FormErrors = {}
  const parsed = campaignCreateSchema.safeParse({
    ...data,
    drawDate: data.drawDate || undefined,
    subtitle: data.subtitle || undefined,
    shareText: data.shareText || undefined,
    rules: data.rules || undefined,
  })

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    for (const [key, msgs] of Object.entries(fieldErrors)) {
      if (msgs?.length) {
        errors[key as keyof CampaignFormData] = msgs[0]
      }
    }
  }

  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    if (start >= end) {
      errors.endDate = "结束时间必须晚于开始时间"
    }
  }

  if (data.drawDate) {
    const draw = new Date(data.drawDate)
    if (data.startDate && draw < new Date(data.startDate)) {
      errors.drawDate = "开奖时间不能早于开始时间"
    }
  }

  data.prizes.forEach((p, i) => {
    if (!p.name.trim()) {
      errors.prizes = `奖品 ${i + 1} 名称不能为空`
    }
    if (p.quantity < 1) {
      errors.prizes = `奖品 ${i + 1} 数量至少为 1`
    }
  })

  return errors
}

export function CampaignFormModal({ isOpen, campaign, onClose, onSuccess }: CampaignFormModalProps) {
  const toast = useToast()
  const isEdit = !!campaign
  const [data, setData] = useState<CampaignFormData>(() => getInitialFormData(campaign))
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Modal is remounted via key prop in parent, so no reset useEffect needed.

  const updateField = <K extends keyof CampaignFormData>(key: K, value: CampaignFormData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  const updatePrize = (index: number, patch: Partial<Prize>) => {
    setData((prev) => ({
      ...prev,
      prizes: prev.prizes.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }))
    setTouched((prev) => ({ ...prev, prizes: true }))
  }

  const addPrize = () => {
    setData((prev) => ({ ...prev, prizes: [...prev.prizes, { ...emptyPrize }] }))
  }

  const removePrize = (index: number) => {
    setData((prev) => ({
      ...prev,
      prizes: prev.prizes.length > 1 ? prev.prizes.filter((_, i) => i !== index) : [{ ...emptyPrize }],
    }))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setTouched({
      title: true,
      startDate: true,
      endDate: true,
      prizes: true,
    })

    const validationErrors = validateForm(data)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSaving(true)
    setErrors({})

    try {
      const body = {
        title: data.title.trim(),
        subtitle: data.subtitle.trim() || undefined,
        startDate: data.startDate,
        endDate: data.endDate,
        drawDate: data.drawDate || undefined,
        prizes: data.prizes.map((p) => ({
          name: p.name.trim(),
          quantity: p.quantity,
          image: p.image?.trim() || undefined,
          description: p.description?.trim() || undefined,
        })),
        shareText: data.shareText.trim() || undefined,
        rules: data.rules.trim() || undefined,
        maxEntries: data.maxEntries,
        sortOrder: data.sortOrder,
      }

      const res = await fetch(
        isEdit ? `/api/admin/campaigns/${campaign.id}` : "/api/admin/campaigns",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        const result = await res.json().catch(() => ({ error: "保存失败" }))
        setErrors({ general: result.error || "保存失败" })
        return
      }

      toast.success(isEdit ? "活动已更新" : "活动已创建")
      onSuccess()
    } catch {
      setErrors({ general: "网络错误，请重试" })
    } finally {
      setSaving(false)
    }
  }

  const handleClose = useCallback(() => {
    if (!saving) onClose()
  }, [saving, onClose])

  const isInvalid = (key: keyof CampaignFormData) => !!errors[key] && touched[key]

  return (
    <CampaignModal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? "编辑活动" : "创建活动"}
      subtitle={isEdit ? "修改活动信息" : "创建新的营销活动"}
      disabled={saving}
      maxWidth="lg"
      titleId="campaign-form-modal-title"
    >
      <form onSubmit={handleSubmit} noValidate>
        {errors.general && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm mb-4"
          >
            <AlertCircle className="w-4 h-4" />
            {errors.general}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-xs font-medium text-[#5E5E5E] mb-1">
              活动标题 <span aria-hidden="true">*</span>
            </label>
            <input
              id="title"
              value={data.title}
              onChange={(e) => updateField("title", e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, title: true }))}
              placeholder="如：六月肌智派好礼"
              aria-required="true"
              aria-invalid={isInvalid("title")}
              aria-describedby={errors.title ? "title-error" : undefined}
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#3D4430]/40",
                isInvalid("title") ? "border-red-300 bg-red-50/30" : "border-[#E9E9E7]"
              )}
            />
            {isInvalid("title") && (
              <p id="title-error" className="text-xs text-red-500 mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="subtitle" className="block text-xs font-medium text-[#5E5E5E] mb-1">
              副标题
            </label>
            <input
              id="subtitle"
              value={data.subtitle}
              onChange={(e) => updateField("subtitle", e.target.value)}
              placeholder="可选副标题"
              className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-xs font-medium text-[#5E5E5E] mb-1">
                开始时间 <span aria-hidden="true">*</span>
              </label>
              <input
                id="startDate"
                type="datetime-local"
                value={data.startDate}
                onChange={(e) => updateField("startDate", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, startDate: true }))}
                aria-required="true"
                aria-invalid={isInvalid("startDate")}
                aria-describedby={errors.startDate ? "startDate-error" : undefined}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#3D4430]/40",
                  isInvalid("startDate") ? "border-red-300 bg-red-50/30" : "border-[#E9E9E7]"
                )}
              />
              {isInvalid("startDate") && (
                <p id="startDate-error" className="text-xs text-red-500 mt-1">{errors.startDate}</p>
              )}
            </div>
            <div>
              <label htmlFor="endDate" className="block text-xs font-medium text-[#5E5E5E] mb-1">
                结束时间 <span aria-hidden="true">*</span>
              </label>
              <input
                id="endDate"
                type="datetime-local"
                value={data.endDate}
                onChange={(e) => updateField("endDate", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, endDate: true }))}
                aria-required="true"
                aria-invalid={isInvalid("endDate")}
                aria-describedby={errors.endDate ? "endDate-error" : undefined}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#3D4430]/40",
                  isInvalid("endDate") ? "border-red-300 bg-red-50/30" : "border-[#E9E9E7]"
                )}
              />
              {isInvalid("endDate") && (
                <p id="endDate-error" className="text-xs text-red-500 mt-1">{errors.endDate}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="drawDate" className="block text-xs font-medium text-[#5E5E5E] mb-1">
              开奖时间
            </label>
            <input
              id="drawDate"
              type="datetime-local"
              value={data.drawDate}
              onChange={(e) => updateField("drawDate", e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, drawDate: true }))}
              aria-invalid={isInvalid("drawDate")}
              aria-describedby={errors.drawDate ? "drawDate-error" : undefined}
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-[#3D4430]/40",
                isInvalid("drawDate") ? "border-red-300 bg-red-50/30" : "border-[#E9E9E7]"
              )}
            />
            {isInvalid("drawDate") && (
              <p id="drawDate-error" className="text-xs text-red-500 mt-1">{errors.drawDate}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[#5E5E5E]">
                奖品列表 <span aria-hidden="true">*</span>
              </label>
              <button
                type="button"
                onClick={addPrize}
                className="inline-flex items-center gap-1 text-xs text-[#3D4430] hover:text-[#3D4430]/80 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                添加奖品
              </button>
            </div>
            <div className="space-y-2">
              {data.prizes.map((prize, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border space-y-3",
                    touched.prizes && errors.prizes && (!prize.name.trim() || prize.quantity < 1)
                      ? "border-red-300 bg-red-50/20"
                      : "border-[#E9E9E7]"
                  )}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="sr-only" htmlFor={`prize-name-${index}`}>奖品名称</label>
                      <input
                        id={`prize-name-${index}`}
                        value={prize.name}
                        onChange={(e) => updatePrize(index, { name: e.target.value })}
                        placeholder="奖品名称 *"
                        className="w-full px-3 py-2 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="sr-only" htmlFor={`prize-qty-${index}`}>数量</label>
                      <input
                        id={`prize-qty-${index}`}
                        type="number"
                        min={1}
                        value={prize.quantity}
                        onChange={(e) => updatePrize(index, { quantity: Number(e.target.value) })}
                        placeholder="数量 *"
                        className="w-full px-3 py-2 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="sr-only" htmlFor={`prize-image-${index}`}>图片 URL</label>
                      <input
                        id={`prize-image-${index}`}
                        value={prize.image || ""}
                        onChange={(e) => updatePrize(index, { image: e.target.value })}
                        placeholder="图片 URL（可选）"
                        className="w-full px-3 py-2 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="sr-only" htmlFor={`prize-desc-${index}`}>描述</label>
                      <input
                        id={`prize-desc-${index}`}
                        value={prize.description || ""}
                        onChange={(e) => updatePrize(index, { description: e.target.value })}
                        placeholder="描述（可选）"
                        className="w-full px-3 py-2 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removePrize(index)}
                      aria-label={`删除奖品 ${index + 1}`}
                      className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {touched.prizes && errors.prizes && (
              <p className="text-xs text-red-500 mt-1">{errors.prizes}</p>
            )}
          </div>

          <div>
            <label htmlFor="shareText" className="block text-xs font-medium text-[#5E5E5E] mb-1">
              小红书分享文案
            </label>
            <textarea
              id="shareText"
              value={data.shareText}
              onChange={(e) => updateField("shareText", e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
              placeholder="支持 {{nickname}} 占位符"
            />
          </div>

          <div>
            <label htmlFor="rules" className="block text-xs font-medium text-[#5E5E5E] mb-1">
              活动规则 (Markdown)
            </label>
            <textarea
              id="rules"
              value={data.rules}
              onChange={(e) => updateField("rules", e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
              placeholder="活动规则说明（可选，支持 Markdown）"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maxEntries" className="block text-xs font-medium text-[#5E5E5E] mb-1">
                参与上限 (0=不限)
              </label>
              <input
                id="maxEntries"
                type="number"
                min={0}
                value={data.maxEntries}
                onChange={(e) => updateField("maxEntries", Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
              />
            </div>
            <div>
              <label htmlFor="sortOrder" className="block text-xs font-medium text-[#5E5E5E] mb-1">
                排序权重
              </label>
              <input
                id="sortOrder"
                type="number"
                value={data.sortOrder}
                onChange={(e) => updateField("sortOrder", Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-[#E9E9E7]">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg text-sm text-[#5E5E5E] hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3D4430] text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#3D4430]/90 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isEdit ? "保存修改" : "创建活动"}
          </button>
        </div>
      </form>
    </CampaignModal>
  )
}
