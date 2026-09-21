"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Cake,
  Camera,
  Check,
  ChevronRight,
  Coins,
  Loader2,
  Pencil,
  Settings2,
  Smartphone,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { fetchWithCsrf, POINTS_CHANGED_EVENT } from "@/lib/fetch-client";
import { uploadImage } from "@/lib/upload-client";
import { ACCOUNT_CARD, ACCOUNT_ENTRY_ROW, ACCOUNT_AVATAR_SHADOW } from "@/components/website/account-styles";
import type { User } from "@/components/auth/UserProvider";

// 主站 origin（安全中心等站外链接）：取值口径与 AccountMallTab 一致，本地/预发可随环境变量切换
const SSO_BASE_URL = (process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn").replace(/\/+$/, "");

/** GET /api/account/profile 响应（birthday 不在契约内，兼容返回则展示） */
interface AccountProfile {
  nickname: string | null;
  avatar: string | null;
  gender: "male" | "female" | null;
  phone: string | null;
  membershipLevel: string | null;
  birthday?: string | null;
}

function maskPhone(phone?: string | null) {
  if (!phone) return "—";
  if (phone.length <= 7) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}

interface AccountMyTabProps {
  user: User;
  /** 会话过期时的登录引导：由 AccountModal 统一处理（先关弹层再开 AuthModal，避免层级/焦点冲突） */
  onRequestLogin: () => void;
}

/**
 * 「我的」页左列（移动端在上）：资料可编辑（头像/昵称/生日/性别走 BFF /api/account/profile），
 * 积分余额、安全中心链接；会员等级与权益由 AccountMembershipTab 同页右列展示。
 * 身份摘要/测肤派系与用量在面板根视图展示。
 */
export function AccountMyTab({ user, onRequestLogin }: AccountMyTabProps) {
  const { refresh } = useAuth();
  const toast = useToast();

  // 主站资料（BFF）：拉取失败时回退展示 UserProvider 的会话字段
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  // 保存进行态（防重复提交）：avatar / nickname / birthday / gender
  const [saving, setSaving] = useState<string | null>(null);
  // 保存互斥锁用 ref：state 闭包在连续事件里可能读到旧值，ref 才是可靠锁
  const savingRef = useRef(false);
  // 会话过期（BFF 返回 401）：本地 user 态未同步时的兜底引导
  const [sessionExpired, setSessionExpired] = useState(false);
  // 生日一次性锁定：403 birthday_locked 后禁用输入
  const [birthdayLocked, setBirthdayLocked] = useState(false);

  // 昵称行内编辑
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");

  // 积分余额：null = 接口返回不可用（隐藏该行）；undefined 未加载完
  const [points, setPoints] = useState<number | null | undefined>(undefined);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // 账号切换时先清空旧数据，避免重取期间展示上一账号的内容
    setProfile(null);
    setPoints(null);
    setBirthdayLocked(false);
    setSessionExpired(false);
    fetch("/api/account/profile")
      .then((r) => {
        if (r.status === 401) {
          if (!cancelled) setSessionExpired(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (!cancelled && data) setProfile(data as AccountProfile);
      })
      .catch(() => { /* 回退到会话字段展示 */ });
    fetch("/api/account/points")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setPoints(typeof data?.available === "number" ? data.available : null);
      })
      .catch(() => { if (!cancelled) setPoints(null); });
    return () => { cancelled = true; };
    // 账号切换（user.id 变化）时重新拉取，避免展示上一账号的残留数据
  }, [user?.id]);

  // 打卡实际到账积分后（POINTS_CHANGED_EVENT）静默刷新余额，保持与主站账本一致；
  // 刷新失败保留旧值（不把余额行闪成不可用）
  useEffect(() => {
    const onPointsChanged = () => {
      fetch("/api/account/points")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setPoints(typeof data?.available === "number" ? data.available : null))
        .catch(() => { /* 保留旧值 */ });
    };
    window.addEventListener(POINTS_CHANGED_EVENT, onPointsChanged);
    return () => window.removeEventListener(POINTS_CHANGED_EVENT, onPointsChanged);
  }, [user?.id]);

  /**
   * PATCH /api/account/profile 的请求本体（不含互斥锁）：403 视为生日锁定；成功后刷新会话用户态。
   * 调用方负责持锁与 saving 态展示。
   */
  const requestProfilePatch = async (
    body: { nickname?: string; avatar?: string; birthday?: string; gender?: "male" | "female" | null }
  ): Promise<boolean> => {
    try {
      const res = await fetchWithCsrf("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setSessionExpired(true);
        toast.error("登录状态已过期，请重新登录");
        return false;
      }
      if (res.status === 403 && body.birthday !== undefined) {
        // 仅生日锁定才禁用输入框；CSRF 拦截/权限不足/scope 配置缺失等其他 403 不误锁
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        if (errData?.error === "birthday_locked") {
          setBirthdayLocked(true);
          toast.warning("生日已设置过，如需修改请联系客服");
          return false;
        }
        toast.error("保存未成功，请稍后再试");
        return false;
      }
      if (!res.ok) {
        toast.error("保存未成功，请稍后再试");
        return false;
      }
      const data = (await res.json().catch(() => null)) as AccountProfile | null;
      if (data) setProfile(data);
      toast.success("已保存");
      // 同步 UserProvider 会话用户态（昵称/头像/会员徽章全站可见）
      await refresh();
      return true;
    } catch {
      toast.error("网络异常，保存未成功");
      return false;
    }
  };

  /** 带互斥锁的保存入口（ref 锁：state 闭包在连续事件里可能读到旧值） */
  const patchProfile = async (
    body: { nickname?: string; avatar?: string; birthday?: string; gender?: "male" | "female" | null },
    field: string
  ): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(field);
    try {
      return await requestProfilePatch(body);
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || savingRef.current) return;
    // 上传与 PATCH 同一把锁、同一个 saving 态：避免上传完成到 PATCH 之间出现空窗
    savingRef.current = true;
    setSaving("avatar");
    try {
      const url = await uploadImage(file, file.name || "avatar.jpg");
      await requestProfilePatch({ avatar: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "头像上传未成功，请稍后再试");
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  };

  const startEditNickname = () => {
    setNicknameDraft(profile?.nickname ?? user.name ?? "");
    setEditingNickname(true);
  };

  const saveNickname = async () => {
    const nickname = nicknameDraft.trim();
    if (!nickname) {
      toast.warning("昵称不能为空");
      return;
    }
    if (nickname === (profile?.nickname ?? user.name ?? "")) {
      setEditingNickname(false);
      return;
    }
    const ok = await patchProfile({ nickname }, "nickname");
    if (ok) setEditingNickname(false);
  };

  const displayName = profile?.nickname ?? user.name ?? "朋友";
  const displayAvatar = profile?.avatar ?? user.avatar;
  const displayPhone = profile?.phone ?? maskPhone(user.phone);
  // 积分接口必须要有手机号才可能返回数据（无手机号时后端直接降级），据此决定是否展示骨架
  const hasPhone = Boolean(profile?.phone || user.phone);
  const todayStr = new Date().toISOString().slice(0, 10);
  const birthdayValue = profile?.birthday ? profile.birthday.slice(0, 10) : "";
  const genderValue = profile?.gender ?? user.gender ?? null;

  return (
    <div className="w-full">
      {/* 会话过期（BFF 401）：本地 user 态未同步时的兜底引导 */}
      {sessionExpired && (
        <div
          role="alert"
          className="w-full mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900"
        >
          <span>登录状态已过期，资料信息可能不是最新</span>
          <button
            type="button"
            onClick={onRequestLogin}
            className="shrink-0 h-7 px-3 rounded-full border border-amber-300 bg-white/70 text-[12px] hover:bg-white transition-colors cursor-pointer"
          >
            重新登录
          </button>
        </div>
      )}

      {/* 身份区：头像 / 昵称 / 手机号 / 积分余额（会员等级见右侧等级卡，此处不重复徽章） */}
      <div className="flex flex-col items-center">
        {/* 头像：点击更换（上传 OSS 后 PATCH 主站资料） */}
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={saving !== null}
          aria-label="更换头像"
          className={`group relative w-24 h-24 rounded-full overflow-hidden bg-[#ECEBE6] ${ACCOUNT_AVATAR_SHADOW} mb-4 cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 focus-visible:ring-offset-2`}
        >
          {displayAvatar ? (
            <Image src={displayAvatar} alt="" fill unoptimized className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl font-medium text-[#6B5E50]">
              {(displayName[0] || "?").toUpperCase()}
            </div>
          )}
          <span className="absolute inset-x-0 bottom-0 h-7 flex items-center justify-center bg-black/35 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            {saving === "avatar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          </span>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleAvatarChange}
        />

        {/* 昵称：点击进入行内编辑（≤20 字符） */}
        {editingNickname ? (
          <div className="flex items-center gap-2 mb-1.5">
            <input
              autoFocus
              value={nicknameDraft}
              maxLength={20}
              onChange={(e) => setNicknameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveNickname();
                if (e.key === "Escape") setEditingNickname(false);
              }}
              disabled={saving === "nickname"}
              aria-label="昵称"
              className="w-40 text-center text-lg font-semibold text-brand-charcoal bg-white border border-brand-charcoal/20 rounded-xl px-3 py-1 focus:outline-none focus:border-brand-charcoal/50"
            />
            <button
              type="button"
              onClick={saveNickname}
              disabled={saving !== null}
              aria-label="保存昵称"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-charcoal/[0.08] text-brand-charcoal hover:bg-brand-charcoal/15 transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving === "nickname" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setEditingNickname(false)}
              disabled={saving !== null}
              aria-label="取消编辑"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/55 hover:text-brand-charcoal transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-xl font-semibold text-brand-charcoal mb-1.5 flex items-center gap-2">
            {displayName}
            <button
              type="button"
              onClick={startEditNickname}
              aria-label="修改昵称"
              className="w-6 h-6 flex items-center justify-center rounded-full text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </p>
        )}

        {/* 手机号（主站已掩码；回退值本地掩码） */}
        <div className="flex items-center gap-1.5 text-[13px] text-brand-charcoal/60 mb-1.5">
          <Smartphone className="w-3.5 h-3.5" />
          <span>{displayPhone}</span>
        </div>

        {/* 积分余额：无手机号时接口必降级（不显示会闪一下的骨架）；有手机号时保留骨架，避免下方内容跳动 */}
        {hasPhone && points === undefined ? (
          <div aria-hidden="true" className="h-5 w-28 rounded-full bg-brand-charcoal/[0.05] animate-pulse mb-4" />
        ) : typeof points === "number" ? (
          <div className="flex items-center gap-1.5 text-[13px] text-brand-bronze mb-4">
            <Coins className="w-3.5 h-3.5" />
            <span>积分余额 {points}</span>
          </div>
        ) : null}
      </div>

      {/* 资料编辑：生日（一次性，锁定后需客服）+ 性别（三态） */}
      <div className={`w-full ${ACCOUNT_CARD} mb-4 divide-y divide-brand-charcoal/[0.06]`}>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[13px] tracking-[0.05em] text-brand-charcoal/60">
            <Cake className="w-4 h-4" />
            生日
          </span>
          {birthdayLocked ? (
            <span className="text-[12px] text-brand-charcoal/45">已设置，修改请联系客服</span>
          ) : (
            <input
              type="date"
              value={birthdayValue}
              max={todayStr}
              disabled={saving !== null}
              aria-label="生日"
              onChange={(e) => {
                const v = e.target.value;
                if (v && v !== birthdayValue) patchProfile({ birthday: v }, "birthday");
              }}
              className="text-[13px] text-brand-charcoal bg-transparent border border-brand-charcoal/15 rounded-lg px-2 py-1 focus:outline-none focus:border-brand-charcoal/40 disabled:opacity-50"
            />
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[13px] tracking-[0.05em] text-brand-charcoal/60">
            <Pencil className="w-4 h-4" />
            性别
          </span>
          <div className="inline-flex rounded-full border border-brand-charcoal/[0.12] bg-white p-0.5" role="group" aria-label="性别">
            {([
              { value: "male", label: "男" },
              { value: "female", label: "女" },
              { value: null, label: "保密" },
            ] as const).map((opt) => (
              <button
                key={opt.label}
                type="button"
                disabled={saving !== null}
                aria-pressed={genderValue === opt.value}
                onClick={() => {
                  if (genderValue !== opt.value) patchProfile({ gender: opt.value }, "gender");
                }}
                className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 ${
                  genderValue === opt.value
                    ? "bg-brand-charcoal/[0.08] text-brand-charcoal font-medium"
                    : "text-brand-charcoal/60 hover:text-brand-charcoal"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 安全中心：主站账号中心（设备与授权管理），新窗口打开 */}
      <a
        href={`${SSO_BASE_URL}/account`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${ACCOUNT_ENTRY_ROW} mb-6`}
      >
        <span className="inline-flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          安全中心（设备与授权管理）
        </span>
        <ChevronRight className="w-4 h-4 text-brand-charcoal/65 transition-transform duration-300 group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}
