"use client"

import { adminFetch } from "@/lib/admin-fetch"
import { useState, useEffect, useCallback } from "react"
import { Search, Loader2, Check, Package } from "lucide-react"
import { CampaignModal } from "./CampaignModal"
import { cn } from "@/lib/utils"
import { CATEGORY_OPTIONS } from "@/types/product"

interface ProductBrief {
  id: string
  name: string
  category: string
  image: string
  price: string
  description: string
  active: boolean
}

interface ProductPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (products: ProductBrief[]) => void
  selectedIds?: string[]
}

export function ProductPickerModal({ isOpen, onClose, onSelect, selectedIds = [] }: ProductPickerModalProps) {
  const [products, setProducts] = useState<ProductBrief[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds))

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await adminFetch("/api/admin/products?limit=500")
      if (!res.ok) throw new Error("获取产品列表失败")
      const data = await res.json()
      const mapped: ProductBrief[] = (data.products || []).map(
        (p: Record<string, unknown>) => ({
          id: String(p.id ?? ""),
          name: String(p.name ?? ""),
          category: String(p.category ?? ""),
          image: String(p.image ?? ""),
          price: String(p.price ?? ""),
          description: String(p.description ?? ""),
          active: p.active !== false,
        })
      )
      setProducts(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchProducts()
      setChecked(new Set(selectedIds))
      setSearch("")
      setCategory("")
    }
  }, [isOpen, fetchProducts, selectedIds])

  const toggleProduct = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleConfirm = () => {
    const selected = products.filter((p) => checked.has(p.id))
    onSelect(selected)
    onClose()
  }

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (category && p.category !== category) return false
    return true
  })

  return (
    <CampaignModal
      isOpen={isOpen}
      onClose={onClose}
      title="从产品库选择奖品"
      subtitle="选择奖品商品（包含全部产品，不受上架状态限制）"
      maxWidth="4xl"
      titleId="product-picker-modal-title"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5E5E5E]/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索产品名称..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E9E9E7] text-sm focus:outline-none focus:border-[#3D4430]/40"
          />
        </div>
        <label htmlFor="product-picker-category" className="sr-only">品类筛选</label>
        <select
          id="product-picker-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E9E9E7] text-sm bg-white"
        >
          <option value="">全部品类</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#5E5E5E]" />
        </div>
      ) : error ? (
        <div className="text-center py-16 text-sm text-red-500">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[#E9E9E7] rounded-xl">
          <Package className="w-10 h-10 text-[#8B7355]/30 mx-auto mb-3" />
          <p className="text-sm text-[#5E5E5E]">没有匹配的产品</p>
        </div>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto space-y-1 pr-1">
          {filtered.map((p) => {
            const isChecked = checked.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProduct(p.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl border text-left transition-all",
                  isChecked
                    ? "border-[#3D4430] bg-[#3D4430]/5"
                    : "border-[#E9E9E7] hover:border-[#3D4430]/30"
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                    isChecked
                      ? "bg-[#3D4430] border-[#3D4430]"
                      : "border-[#E9E9E7]"
                  )}
                >
                  {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className="w-14 h-14 rounded-lg border border-[#E9E9E7] bg-gray-50 overflow-hidden shrink-0">
                  {p.image && (
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#1A1A1A] truncate">{p.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#5E5E5E]">{p.category}</span>
                    <span className="text-xs text-[#8B7355] font-medium">{p.price}</span>
                    {!p.active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">
                        已下架
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#5E5E5E]/60 mt-0.5 line-clamp-1">{p.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#E9E9E7]">
        <span className="text-sm text-[#5E5E5E]">
          已选 <span className="font-medium text-[#3D4430]">{checked.size}</span> 件产品
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm text-[#5E5E5E] hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={checked.size === 0}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[#3D4430] text-white hover:bg-[#3D4430]/90 disabled:opacity-40 transition-colors"
          >
            确认选择
          </button>
        </div>
      </div>
    </CampaignModal>
  )
}
