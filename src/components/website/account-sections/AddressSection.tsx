"use client";

/**
 * AddressSection — 收货地址簿（移植自主站 ProfilePanel 的地址区块）
 * 数据走 BFF `/api/account/addresses`（代理官网 OAuth 端点，Bearer 转发，单一数据源）；
 * 地址仅用于积分兑礼寄送。纯区块组件，由「个人信息」面板以行内展开方式承载。
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { fetchWithCsrf } from "@/lib/fetch-client";

export interface UserAddressItem {
  id: string;
  recipient: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
}

interface AddressSectionProps {
  /** 会话过期（401）：交给账户弹层统一走登录引导 */
  onSessionExpired: () => void;
  /** 地址数量变化上报（父级「收货地址」行展示 已设置/未设置 用） */
  onCountChange?: (count: number) => void;
}

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white/60 px-4 py-3 text-base text-stone-800 outline-none transition-colors placeholder:text-stone-300 focus:border-stone-400 md:text-sm";

const MAX_ADDRESSES = 20;

type AddressListResponse = {
  success?: boolean;
  data?: { addresses?: UserAddressItem[]; address?: UserAddressItem };
  error?: { code?: string; message?: string };
};

export function AddressSection({ onSessionExpired, onCountChange }: AddressSectionProps) {
  const toast = useToast();
  const [addresses, setAddresses] = useState<UserAddressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // 表单（新增/编辑共用）
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [detail, setDetail] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // 删除两步确认：第一次点击进入确认态（行内「确认删除/取消」，避免再叠一层弹窗）
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const request = useCallback(
    async (input: string, init?: RequestInit): Promise<{ res: Response; data: AddressListResponse | null }> => {
      const res = init ? await fetchWithCsrf(input, init) : await fetch(input, { cache: "no-store" });
      if (res.status === 401) {
        onSessionExpired();
        return { res, data: null };
      }
      return { res, data: (await res.json().catch(() => null)) as AddressListResponse | null };
    },
    [onSessionExpired]
  );

  const load = useCallback(async () => {
    setLoadError(false);
    const { res, data } = await request("/api/account/addresses");
    if (!res.ok || !data?.success) {
      if (!data) return; // 401 已交给登录引导
      setLoadError(true);
    } else {
      const list = data.data?.addresses ?? [];
      setAddresses(list);
      onCountChange?.(list.length);
    }
    setLoading(false);
  }, [request, onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setRecipient("");
    setPhone("");
    setRegion("");
    setDetail("");
    setIsDefault(false);
  };

  const startEdit = (a: UserAddressItem) => {
    setEditingId(a.id);
    setRecipient(a.recipient);
    setPhone(a.phone);
    setRegion(a.region);
    setDetail(a.detail);
    setIsDefault(a.isDefault);
    setShowForm(true);
  };

  const saveAddress = async () => {
    if (!recipient.trim()) {
      toast.warning("请填写收货人姓名");
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.warning("请输入正确的手机号");
      return;
    }
    if (!region.trim()) {
      toast.warning("请填写省市区");
      return;
    }
    if (!detail.trim()) {
      toast.warning("请填写详细地址");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        recipient: recipient.trim(),
        phone,
        region: region.trim(),
        detail: detail.trim(),
        isDefault,
      };
      const { data } = await request(
        editingId ? `/api/account/addresses/${editingId}` : "/api/account/addresses",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!data) return; // 401 已处理
      if (!data.success) {
        toast.error(data.error?.message || "保存失败，请稍后重试");
        return;
      }
      setShowForm(false);
      resetForm();
      toast.success(editingId ? "地址已更新" : "地址已添加");
      // 默认地址顺延/新旧默认切换由官网侧事务处理，重新拉取保证列表与默认态一致
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const { data } = await request(`/api/account/addresses/${id}`, { method: "DELETE" });
      if (!data) return; // 401 已处理
      if (!data.success) {
        toast.error(data.error?.message || "删除失败，请稍后重试");
        return;
      }
      setConfirmingDeleteId(null);
      toast.success("地址已删除");
      await load();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-stone-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 地址加载中...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-3 text-xs text-stone-500">
        <span>地址加载失败</span>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="rounded-full border border-stone-200 px-3 py-1 text-stone-600 transition-colors hover:bg-white/60 cursor-pointer"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.length === 0 ? (
        <p className="text-sm text-stone-400">暂无收货地址，积分兑礼寄送前请先添加</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-stone-200/60 bg-white/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800">
                  {a.recipient}
                  <span className="ml-2 text-xs font-normal text-stone-400">{a.phone}</span>
                  {a.isDefault && (
                    <span className="ml-2 rounded-full bg-[#00263e]/10 px-2 py-0.5 text-[11px] text-[#00263e]">
                      默认
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">
                  {a.region} {a.detail}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {confirmingDeleteId === a.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      disabled={deleting}
                      className="flex items-center gap-1 text-xs text-red-500 transition-colors hover:text-red-600 disabled:opacity-50 cursor-pointer"
                    >
                      {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      确认删除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      disabled={deleting}
                      className="text-xs text-stone-500 transition-colors hover:text-stone-800 disabled:opacity-50 cursor-pointer"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="flex items-center gap-1 text-xs text-stone-500 transition-colors hover:text-stone-800 cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" />
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(a.id)}
                      className="flex items-center gap-1 text-xs text-stone-400 transition-colors hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      删除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => {
            if (addresses.length >= MAX_ADDRESSES) {
              toast.warning(`最多保留 ${MAX_ADDRESSES} 个收货地址`);
              return;
            }
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-3 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-800 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          新增地址
        </button>
      )}

      {showForm && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#00263e]" />
            <h4 className="text-sm font-medium text-stone-700">
              {editingId ? "编辑收货地址" : "新增收货地址"}
            </h4>
          </div>
          <p className="text-xs text-stone-400">
            地址仅用于积分兑礼礼品寄送，不会用于其他用途；可随时修改或删除。
          </p>
          <div>
            <label htmlFor="addr-recipient" className="mb-1 block text-xs text-stone-500">
              收货人 <span className="text-[#00263e]">*</span>
            </label>
            <input
              id="addr-recipient"
              type="text"
              maxLength={20}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="收货人姓名"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="addr-phone" className="mb-1 block text-xs text-stone-500">
              手机号 <span className="text-[#00263e]">*</span>
            </label>
            <input
              id="addr-phone"
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="收货手机号"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="addr-region" className="mb-1 block text-xs text-stone-500">
              省市区 <span className="text-[#00263e]">*</span>
            </label>
            <input
              id="addr-region"
              type="text"
              maxLength={50}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="如：上海市 浦东新区"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="addr-detail" className="mb-1 block text-xs text-stone-500">
              详细地址 <span className="text-[#00263e]">*</span>
            </label>
            <input
              id="addr-detail"
              type="text"
              maxLength={120}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="街道、门牌号等"
              className={inputClass}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#00263e]"
            />
            设为默认地址
          </label>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={saveAddress}
              disabled={saving}
              className="rounded-full bg-[#00263e] px-6 py-2.5 text-sm text-white transition-colors hover:bg-[#0d3b5c] disabled:opacity-50 cursor-pointer"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={saving}
              className="rounded-full border border-stone-200 px-6 py-2.5 text-sm text-stone-600 transition-colors hover:bg-white/60 disabled:opacity-50 cursor-pointer"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
