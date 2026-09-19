"use client";

import Image from "next/image";
import { createElement, useEffect, useRef, useState } from "react";
import {
  Cake,
  Camera,
  Check,
  ChevronRight,
  Coins,
  Loader2,
  LogOut,
  NotebookPen,
  Pencil,
  Settings2,
  Smartphone,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { useDiaryModal } from "@/components/website/DiaryModalContext";
import { getFactionIcon } from "@/components/website/faction-icons";
import { getMemberBadge } from "@/components/website/member-badges";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { uploadImage } from "@/lib/upload-client";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import type { User } from "@/components/auth/UserProvider";
import type { HistorySession } from "@/components/website/TestHistoryList";

/** GET /api/account/profile 响应（birthday 不在契约内，兼容返回则展示） */
interface AccountProfile {
  nickname: string | null;
  avatar: string | null;
  gender: "male" | "female" | null;
  phone: string | null;
  membershipLevel: string | null;
  birthday?: string | null;
}

/** /api/advisor/test-limit 的 usage 字段（登录用户） */
interface TestUsage {
  totalUsed: number;
  todayUsed: number;
  lifetimeLimit: number | null;
  dailyLimit: number | null;
  unlimited: boolean;
}

function maskPhone(phone?: string | null) {
  if (!phone) return "—";
  if (phone.length <= 7) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}

interface AccountMyTabProps {
  user: User;
  onClose: () => void;
  onRequestLogout: () => void;
}

/**
 * 「我的」tab：资料可编辑（头像/昵称/生日/性别走 BFF /api/account/profile），
 * 积分余额、测肤派系、测肤用量、护肤档案入口、安全中心链接、退出登录。
 */
export function AccountMyTab({ user, onClose, onRequestLogout }: AccountMyTabProps) {
  const { refresh } = useAuth();
  const toast = useToast();
  const { openDiaryModal } = useDiaryModal();

  // 主站资料（BFF）：拉取失败时回退展示 UserProvider 的会话字段
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  // 保存进行态（防重复提交）：avatar / nickname / birthday / gender
  const [saving, setSaving] = useState<string | null>(null);
  // 生日一次性锁定：403 birthday_locked 后禁用输入
  const [birthdayLocked, setBirthdayLocked] = useState(false);

  // 昵称行内编辑
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");

  // 积分余额：null = 接口返回不可用（隐藏该行）；undefined 未加载完
  const [points, setPoints] = useState<number | null | undefined>(undefined);

  // 测肤用量 / 最新测肤派系（接口失败静默不展示）
  const [testUsage, setTestUsage] = useState<TestUsage | null>(null);
  const [latestPersona, setLatestPersona] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/profile")
      .then((r) => (r.ok ? r.json() : null))
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
    fetch("/api/advisor/test-limit")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.usage) setTestUsage(data.usage as TestUsage);
      })
      .catch(() => { /* 静默失败 */ });
    // 最新派系：复用 history 接口（lite），仅取第一条的 persona
    fetch("/api/advisor/history?page=1&limit=1&lite=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const latest = (data?.history as HistorySession[] | undefined)?.[0];
        const persona = (latest?.analysisResult as { persona?: string } | undefined)?.persona;
        setLatestPersona(persona ?? null);
      })
      .catch(() => { /* 静默失败 */ });
    return () => { cancelled = true; };
  }, []);

  /** PATCH /api/account/profile：403 视为生日锁定；成功后刷新会话用户态 */
  const patchProfile = async (
    body: { nickname?: string; avatar?: string; birthday?: string; gender?: "male" | "female" | null },
    field: string
  ): Promise<boolean> => {
    if (saving) return false;
    setSaving(field);
    try {
      const res = await fetchWithCsrf("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 403 && body.birthday !== undefined) {
        setBirthdayLocked(true);
        toast.warning("生日已设置过，如需修改请联系客服");
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
    } finally {
      setSaving(null);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || saving) return;
    setSaving("avatar");
    try {
      const url = await uploadImage(file, file.name || "avatar.jpg");
      setSaving(null);
      await patchProfile({ avatar: url }, "avatar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "头像上传未成功，请稍后再试");
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
  const badge = getMemberBadge(profile?.membershipLevel ?? user.membershipLevel);
  const latestPersonaType = latestPersona ? getSkinTypeByIpKey(latestPersona) : null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const birthdayValue = profile?.birthday ? profile.birthday.slice(0, 10) : "";
  const genderValue = profile?.gender ?? user.gender ?? null;

  return (
    <div className="w-full flex flex-col items-center">
      {/* 头像：点击更换（上传 OSS 后 PATCH 主站资料） */}
      <button
        type="button"
        onClick={() => avatarInputRef.current?.click()}
        disabled={saving !== null}
        aria-label="更换头像"
        className="group relative w-24 h-24 rounded-full overflow-hidden bg-[#ECEBE6] shadow-md mb-4 cursor-pointer disabled:cursor-wait"
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

      {/* 昵称：点击进入行内编辑（≤20 字符）+ 会员徽章 */}
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
            className="w-40 text-center text-lg font-semibold text-[#1A1A1A] bg-white border border-brand-charcoal/20 rounded-xl px-3 py-1 focus:outline-none focus:border-brand-charcoal/50"
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
        <p className="text-xl font-semibold text-[#1A1A1A] mb-1.5 flex items-center gap-2">
          {displayName}
          <button
            type="button"
            onClick={startEditNickname}
            aria-label="修改昵称"
            className="w-6 h-6 flex items-center justify-center rounded-full text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/5 transition-colors cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <span className={`text-[10px] font-light tracking-[0.1em] px-2 py-0.5 rounded-full border ${badge.className}`}>
            {badge.label}
          </span>
        </p>
      )}

      {/* 手机号（主站已掩码；回退值本地掩码） */}
      <div className="flex items-center gap-1.5 text-[13px] text-[#5E5E5E] mb-1.5">
        <Smartphone className="w-3.5 h-3.5" />
        <span>{displayPhone}</span>
      </div>

      {/* 积分余额：主站返回 available 为 null 时隐藏 */}
      {typeof points === "number" && (
        <div className="flex items-center gap-1.5 text-[13px] text-[#8B7355] mb-1.5">
          <Coins className="w-3.5 h-3.5" />
          <span>积分余额 {points}</span>
        </div>
      )}

      {/* 最新测肤派系 */}
      {latestPersonaType && (
        <span className="mb-2 inline-flex h-[22px] px-2 items-center gap-1 rounded-full border border-brand-charcoal/[0.1] bg-white/60 text-[11px] font-light tracking-[0.04em] text-brand-charcoal/70 whitespace-nowrap">
          {createElement(getFactionIcon(latestPersonaType.ipKey), {
            className: "w-3 h-3 text-brand-charcoal/60 shrink-0",
            strokeWidth: 1.5,
          })}
          我的肌智派形象 · {latestPersonaType.typeName}
        </span>
      )}

      {/* 测肤用量：普通/银卡显示终身用量，金卡/钻石不限次显示当日用量；接口失败不渲染 */}
      {testUsage && (
        <p className="text-[12px] text-[#6B5E50] font-light tracking-[0.05em] mb-4">
          {testUsage.unlimited
            ? `测肤不限次（今日已用 ${testUsage.todayUsed}/${testUsage.dailyLimit ?? 10}）`
            : `测肤已用 ${testUsage.totalUsed} / 共 ${testUsage.lifetimeLimit ?? 10} 次`}
        </p>
      )}

      {/* 资料编辑：生日（一次性，锁定后需客服）+ 性别（三态） */}
      <div className="w-full rounded-2xl border border-brand-charcoal/[0.08] bg-white/70 mb-3 divide-y divide-brand-charcoal/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[13px] tracking-[0.05em] text-[#5E5E5E]">
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
          <span className="inline-flex items-center gap-2 text-[13px] tracking-[0.05em] text-[#5E5E5E]">
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
                className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] transition-colors cursor-pointer disabled:opacity-50 ${
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

      {/* 护肤档案入口：打开全局护肤档案弹层 */}
      <button
        onClick={() => {
          onClose();
          openDiaryModal();
        }}
        className="group w-full flex items-center justify-between px-4 py-3 mb-3 rounded-2xl border border-brand-charcoal/[0.08] bg-white/70 text-[13px] tracking-[0.05em] text-[#5E5E5E] hover:text-brand-charcoal hover:border-brand-charcoal/20 transition-colors cursor-pointer"
      >
        <span className="inline-flex items-center gap-2">
          <NotebookPen className="w-4 h-4" />
          护肤档案
        </span>
        <ChevronRight className="w-4 h-4 text-brand-charcoal/65 transition-transform duration-300 group-hover:translate-x-0.5" />
      </button>

      {/* 安全中心：主站账号中心（设备与授权管理），新窗口打开 */}
      <a
        href="https://nihplod.cn/account"
        target="_blank"
        rel="noopener noreferrer"
        className="group w-full flex items-center justify-between px-4 py-3 mb-6 rounded-2xl border border-brand-charcoal/[0.08] bg-white/70 text-[13px] tracking-[0.05em] text-[#5E5E5E] hover:text-brand-charcoal hover:border-brand-charcoal/20 transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          安全中心（设备与授权管理）
        </span>
        <ChevronRight className="w-4 h-4 text-brand-charcoal/65 transition-transform duration-300 group-hover:translate-x-0.5" />
      </a>

      {/* 退出登录 */}
      <button
        onClick={onRequestLogout}
        className="inline-flex items-center gap-2 text-[13px] tracking-[0.05em] text-[#6B5E50] hover:text-[#1A1A1A] transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        退出登录
      </button>
    </div>
  );
}
