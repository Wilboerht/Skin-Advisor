"use client"

import { useState, useCallback, useMemo } from "react"
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2, Package } from "lucide-react"
import { CampaignModal } from "./CampaignModal"
import { FormField, inputCls, inputAriaProps } from "./FormField"
import { ProductPickerModal } from "./ProductPickerModal"
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

interface PrizeFormItem extends Prize {
  _key: string
}

interface CampaignFormData {
  title: string
  subtitle: string
  description: string
  coverImage: string
  startDate: string
  endDate: string
  drawDate: string
  prizes: PrizeFormItem[]
  shareText: string
  rules: string
  maxEntries: number
  sortOrder: number
}

const emptyPrize = (): PrizeFormItem => ({
  _key: crypto.randomUUID(),
  name: "",
  quantity: 1,
})

function getInitialFormData(campaign?: Campaign | null): CampaignFormData {
  if (campaign) {
    return {
      title: campaign.title,
      subtitle: campaign.subtitle || "",
      description: campaign.description || "",
      coverImage: campaign.coverImage || "",
      startDate: toISOLocalString(new Date(campaign.startDate)),
      endDate: toISOLocalString(new Date(campaign.endDate)),
      drawDate: campaign.drawDate ? toISOLocalString(new Date(campaign.drawDate)) : "",
      prizes:
        campaign.prizes.length > 0
          ? campaign.prizes.map((p) => ({ ...p, _key: crypto.randomUUID() }))
          : [emptyPrize()],
      shareText: campaign.shareText || "",
      rules: campaign.rules || "",
      maxEntries: campaign.maxEntries,
      sortOrder: campaign.sortOrder,
    }
  }
  return {
    title: "",
    subtitle: "",
    description: "",
    coverImage: "",
    startDate: "",
    endDate: "",
    drawDate: "",
    prizes: [emptyPrize()],
    shareText: "",
    rules: "",
    maxEntries: 0,
    sortOrder: 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function cleanPrize({ _key, ...rest }: PrizeFormItem): Prize {
  return rest
}

function validateForm(data: CampaignFormData): FormErrors {
  const errors: FormErrors = {}

  const parsed = campaignCreateSchema.safeParse({
    ...data,
    drawDate: data.drawDate || undefined,
    subtitle: data.subtitle || undefined,
    description: data.description || undefined,
    coverImage: data.coverImage || undefined,
    shareText: data.shareText || undefined,
    rules: data.rules || undefined,
    prizes: data.prizes.map(cleanPrize),
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
    if (data.endDate && draw < new Date(data.endDate)) {
      errors.drawDate = "开奖时间建议在活动结束后"
    }
  }

  if (data.prizes.length === 0) {
    errors.prizes = "至少需要选择一个奖品"
  }

  return errors
}

export function CampaignFormModal({ isOpen, campaign, onClose, onSuccess }: CampaignFormModalProps) {
  const toast = useToast()
  const isEdit = !!campaign
  const [data, setData] = useState<CampaignFormData>(() => getInitialFormData(campaign))
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [confirmClose, setConfirmClose] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const [initialSnapshot] = useState(() => JSON.stringify(getInitialFormData(campaign)))

  const isDirty = useMemo(() => {
    return JSON.stringify(data) !== initialSnapshot
  }, [data, initialSnapshot])

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

  const removePrize = (index: number) => {
    setData((prev) => ({
      ...prev,
      prizes: prev.prizes.filter((_, i) => i !== index),
    }))
  }

  const selectedProductIds = data.prizes.map((p) => p.productId).filter((id): id is string => !!id)

  const handleProductsSelected = (products: { id: string; name: string; image: string; price: string; description: string }[]) => {
    const existingIds = new Set(selectedProductIds)
    const newPrizes: PrizeFormItem[] = products
      .filter((p) => !existingIds.has(p.id))
      .map((p) => ({
        _key: crypto.randomUUID(),
        productId: p.id,
        name: p.name,
        image: p.image || undefined,
        price: p.price || undefined,
        description: p.description || undefined,
        quantity: 1,
      }))
    if (newPrizes.length > 0) {
      setData((prev) => {
        const hasEmpty = prev.prizes.length === 1 && !prev.prizes[0].name && !prev.prizes[0].productId
        return {
          ...prev,
          prizes: hasEmpty
            ? newPrizes
            : [...prev.prizes, ...newPrizes],
        }
      })
      setTouched((prev) => ({ ...prev, prizes: true }))
    }
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
        description: data.description.trim() || undefined,
        coverImage: data.coverImage.trim() || undefined,
        startDate: data.startDate,
        endDate: data.endDate,
        drawDate: data.drawDate || undefined,
        prizes: data.prizes.map(cleanPrize).map((p) => ({
          productId: p.productId || undefined,
          name: p.name.trim(),
          quantity: p.quantity,
          image: p.image?.trim() || undefined,
          price: p.price?.trim() || undefined,
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
    if (saving) return
    if (isDirty && !confirmClose) {
      setConfirmClose(true)
      return
    }
    setConfirmClose(false)
    onClose()
  }, [saving, isDirty, confirmClose, onClose])

  const isInvalid = (key: keyof CampaignFormData) => !!errors[key] && touched[key]

  return (
    <>
      <CampaignModal
        isOpen={isOpen}
        onClose={handleClose}
        title={isEdit ? "编辑活动" : "创建活动"}
        subtitle={isEdit ? "修改活动信息" : "创建新的营销活动"}
        disabled={saving || confirmClose}
        maxWidth="lg"
        titleId="campaign-form-modal-title"
      >
        {confirmClose && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800 mb-3">你有未保存的修改，确定要关闭吗？</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClose(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                继续编辑
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false)
                  onClose()
                }}
                className="px-3 py-1.5 rounded-lg text-xs bg-amber-600 text-white hover:bg-amber-700"
              >
                放弃修改
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {errors.general && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm mb-4"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errors.general}
            </div>
          )}

          <div className="space-y-4">
            <FormField label="活动标题" htmlFor="title" required error={isInvalid("title") ? errors.title : undefined}>
              <input
                id="title"
                value={data.title}
                onChange={(e) => updateField("title", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, title: true }))}
                placeholder="如：六月肌智派好礼"
                className={inputCls(isInvalid("title"))}
                {...inputAriaProps("title", isInvalid("title"))}
              />
            </FormField>

            <FormField label="副标题" htmlFor="subtitle">
              <input
                id="subtitle"
                value={data.subtitle}
                onChange={(e) => updateField("subtitle", e.target.value)}
                placeholder="可选副标题"
                className={inputCls(false)}
              />
            </FormField>

            <FormField label="活动描述" htmlFor="description">
              <textarea
                id="description"
                value={data.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
                className={inputCls(false)}
                placeholder="活动详细描述，将展示在活动页面顶部（可选，支持 Markdown）"
              />
            </FormField>

            <FormField label="封面图片" htmlFor="coverImage" hint="URL">
              <input
                id="coverImage"
                value={data.coverImage}
                onChange={(e) => updateField("coverImage", e.target.value)}
                placeholder="https://... 封面图片地址（可选）"
                className={inputCls(false)}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="开始时间" htmlFor="startDate" required error={isInvalid("startDate") ? errors.startDate : undefined}>
                <input
                  id="startDate"
                  type="datetime-local"
                  value={data.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, startDate: true }))}
                  className={inputCls(isInvalid("startDate"))}
                  {...inputAriaProps("startDate", isInvalid("startDate"))}
                />
              </FormField>
              <FormField label="结束时间" htmlFor="endDate" required error={isInvalid("endDate") ? errors.endDate : undefined}>
                <input
                  id="endDate"
                  type="datetime-local"
                  value={data.endDate}
                  onChange={(e) => updateField("endDate", e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, endDate: true }))}
                  className={inputCls(isInvalid("endDate"))}
                  {...inputAriaProps("endDate", isInvalid("endDate"))}
                />
              </FormField>
            </div>

            <FormField label="开奖时间" htmlFor="drawDate" error={isInvalid("drawDate") ? errors.drawDate : undefined}>
              <input
                id="drawDate"
                type="datetime-local"
                value={data.drawDate}
                onChange={(e) => updateField("drawDate", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, drawDate: true }))}
                className={inputCls(isInvalid("drawDate"))}
                {...inputAriaProps("drawDate", isInvalid("drawDate"))}
              />
            </FormField>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[#5E5E5E]">
                  奖品列表 <span aria-hidden="true">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="inline-flex items-center gap-1 text-xs text-[#3D4430] hover:text-[#3D4430]/80 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  从产品库选择
                </button>
              </div>

              {data.prizes.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-[#E9E9E7] rounded-xl">
                  <Package className="w-8 h-8 text-[#8B7355]/30 mx-auto mb-2" />
                  <p className="text-sm text-[#5E5E5E]">暂未选择奖品</p>
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="mt-2 text-xs text-[#3D4430] underline hover:text-[#3D4430]/80"
                  >
                    从产品库选择奖品
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.prizes.map((prize, index) => (
                    <div
                      key={prize._key}
                      className={cn(
                        "p-3 rounded-lg border space-y-3",
                        touched.prizes && errors.prizes
                          ? "border-red-300 bg-red-50/20"
                          : "border-[#E9E9E7]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {prize.image ? (
                          <div className="w-14 h-14 rounded-lg border border-[#E9E9E7] bg-gray-50 overflow-hidden shrink-0">
                            <img
                              src={prize.image}
                              alt={prize.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-lg border border-[#E9E9E7] bg-gray-50 flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-[#5E5E5E]/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#1A1A1A] truncate">
                            {prize.name || "未命名奖品"}
                          </div>
                          {prize.price && (
                            <div className="text-xs text-[#8B7355] mt-0.5">{prize.price}</div>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <label className="sr-only" htmlFor={`prize-qty-${prize._key}`}>
                              数量
                            </label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-[#5E5E5E]">数量</span>
                              <input
                                id={`prize-qty-${prize._key}`}
                                type="number"
                                min={1}
                                value={prize.quantity}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? 1 : Number(e.target.value)
                                  updatePrize(index, { quantity: Math.max(1, val) })
                                }}
                                className="w-20 px-2.5 py-1.5 rounded-lg border border-[#E9E9E7] text-sm text-center focus:outline-none focus:border-[#3D4430]/40"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePrize(index)}
                          aria-label={`移除奖品 ${prize.name}`}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {!prize.productId && (
                        <div className="space-y-2 pl-0">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="sr-only" htmlFor={`prize-image-${prize._key}`}>
                                图片 URL
                              </label>
                              <input
                                id={`prize-image-${prize._key}`}
                                value={prize.image || ""}
                                onChange={(e) => updatePrize(index, { image: e.target.value })}
                                placeholder="图片 URL（可选）"
                                className={inputCls(false)}
                              />
                            </div>
                            <div>
                              <label className="sr-only" htmlFor={`prize-price-${prize._key}`}>
                                价格
                              </label>
                              <input
                                id={`prize-price-${prize._key}`}
                                value={prize.price || ""}
                                onChange={(e) => updatePrize(index, { price: e.target.value })}
                                placeholder="价格（可选）"
                                className={inputCls(false)}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="sr-only" htmlFor={`prize-desc-${prize._key}`}>
                              描述
                            </label>
                            <input
                              id={`prize-desc-${prize._key}`}
                              value={prize.description || ""}
                              onChange={(e) => updatePrize(index, { description: e.target.value })}
                              placeholder="描述（可选）"
                              className={inputCls(false)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {touched.prizes && errors.prizes && (
                <p className="text-xs text-red-500 mt-1">{errors.prizes}</p>
              )}
            </div>

            <FormField label="小红书分享文案" htmlFor="shareText" hint="支持 {{nickname}} 占位符">
              <textarea
                id="shareText"
                value={data.shareText}
                onChange={(e) => updateField("shareText", e.target.value)}
                rows={3}
                placeholder="在小红书发布时推荐的分享文案"
                className={inputCls(false)}
              />
            </FormField>

            <FormField label="活动规则" htmlFor="rules" hint="支持 Markdown">
              <textarea
                id="rules"
                value={data.rules}
                onChange={(e) => updateField("rules", e.target.value)}
                rows={4}
                placeholder="活动规则说明（可选）"
                className={inputCls(false)}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="参与上限" htmlFor="maxEntries" hint="0=不限">
                <input
                  id="maxEntries"
                  type="number"
                  min={0}
                  value={data.maxEntries}
                  onChange={(e) => {
                    const val = e.target.value === "" ? 0 : Number(e.target.value)
                    updateField("maxEntries", val)
                  }}
                  className={inputCls(false)}
                />
              </FormField>
              <FormField label="排序权重" htmlFor="sortOrder">
                <input
                  id="sortOrder"
                  type="number"
                  value={data.sortOrder}
                  onChange={(e) => {
                    const val = e.target.value === "" ? 0 : Number(e.target.value)
                    updateField("sortOrder", val)
                  }}
                  className={inputCls(false)}
                />
              </FormField>
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

      <ProductPickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleProductsSelected}
        selectedIds={selectedProductIds}
      />
    </>
  )
}
