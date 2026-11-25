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
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/Badge";

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
    try {
      const { res, data } = await request("/api/account/addresses");
      if (!res.ok || !data?.success) {
        // 401 已交给登录引导；网络异常/5xx 走 loadError + 重试按钮
        if (data) setLoadError(true);
        return;
      }
      const list = data.data?.addresses ?? [];
      setAddresses(list);
      onCountChange?.(list.length);
    } catch {
      setLoadError(true);
    } finally {
      // 无论 401、网络异常还是成功，都必须结束 loading，否则面板会永久停在"地址加载中"
      setLoading(false);
    }
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> 地址加载中...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>地址加载失败</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          暂无收货地址，积分兑礼寄送前请先添加
        </p>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="flex items-start justify-between gap-3 rounded-lg border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {address.recipient}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {address.phone}
                  </span>
                  {address.isDefault && (
                    <Badge variant="secondary" className="ml-2">
                      默认
                    </Badge>
                  )}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {address.region} {address.detail}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {confirmingDeleteId === address.id ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(address.id)}
                      disabled={deleting}
                    >
                      {deleting && <Loader2 className="size-3.5 animate-spin" />}
                      确认删除
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDeleteId(null)}
                      disabled={deleting}
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(address)}
                    >
                      <Pencil />
                      编辑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDeleteId(address.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                      删除
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (addresses.length >= MAX_ADDRESSES) {
              toast.warning(`最多保存 ${MAX_ADDRESSES} 个收货地址`);
              return;
            }
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus />
          新增地址
        </Button>
      )}

      {showForm && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">
              {editingId ? "编辑收货地址" : "新增收货地址"}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            地址仅用于积分兑礼礼品寄送，不会用于其他用途；可随时修改或删除。
          </p>

          <Input
            id="addr-recipient"
            label="收货人"
            required
            type="text"
            maxLength={20}
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="收货人姓名"
          />
          <Input
            id="addr-phone"
            label="手机号"
            required
            type="text"
            inputMode="numeric"
            maxLength={11}
            value={phone}
            onChange={(event) =>
              setPhone(event.target.value.replace(/\D/g, ""))
            }
            placeholder="收货手机号"
          />
          <Input
            id="addr-region"
            label="省市区"
            required
            type="text"
            maxLength={50}
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            placeholder="如：上海市 浦东新区"
          />
          <Input
            id="addr-detail"
            label="详细地址"
            required
            type="text"
            maxLength={120}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="街道、门牌号等"
          />

          <div className="flex items-center gap-2">
            <Checkbox
              id="addr-default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <Label htmlFor="addr-default" className="text-sm font-normal">
              设为默认地址
            </Label>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" onClick={saveAddress} loading={saving}>
              {editingId ? "保存修改" : "保存地址"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={saving}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
