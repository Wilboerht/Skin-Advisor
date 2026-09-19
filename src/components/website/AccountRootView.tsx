"use client";

import Image from "next/image";
import { createElement, useEffect, useState } from "react";
import { ChevronRight, Crown, LogOut, NotebookPen, Smartphone } from "lucide-react";
import { useDiaryModal } from "@/components/website/DiaryModalContext";
import { getFactionIcon } from "@/components/website/faction-icons";
import { getMemberBadge } from "@/components/website/member-badges";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import type { User } from "@/components/auth/UserProvider";
import type { HistorySession } from "@/components/website/TestHistoryList";

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

interface AccountRootViewProps {
  user: User;
  onClose: () => void;
  onOpenCenter: () => void;
  onRequestLogout: () => void;
}

/**
 * 用户面板根视图（最早的简洁样式）：身份展示 + 两个入口按钮。
 * 「护肤档案」打开全局档案弹层；「会员中心」进入会员中心视图（我的/会员/积分商城）。
 * 资料编辑在会员中心内进行，本视图纯展示。
 */
export function AccountRootView({ user, onClose, onOpenCenter, onRequestLogout }: AccountRootViewProps) {
  const { openDiaryModal } = useDiaryModal();

  // 测肤用量 / 最新测肤派系（接口失败静默不展示）；账号切换时重新拉取
  const [testUsage, setTestUsage] = useState<TestUsage | null>(null);
  const [latestPersona, setLatestPersona] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTestUsage(null);
    setLatestPersona(null);
    fetch("/api/advisor/test-limit")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.usage) setTestUsage(data.usage as TestUsage);
      })
      .catch(() => { /* 静默失败 */ });
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
  }, [user.id]);

  const badge = getMemberBadge(user.membershipLevel);
  const latestPersonaType = latestPersona ? getSkinTypeByIpKey(latestPersona) : null;

  return (
    <div className="w-full flex flex-col items-center">
      {/* 头像（纯展示；更换在「会员中心 → 我的」） */}
      <div className="w-24 h-24 rounded-full overflow-hidden bg-[#ECEBE6] shadow-md mb-4">
        {user.avatar ? (
          <Image src={user.avatar} alt="" width={96} height={96} unoptimized className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl font-medium text-[#6B5E50]">
            {((user.name ?? "朋")[0] || "?").toUpperCase()}
          </div>
        )}
      </div>

      {/* 昵称 + 会员徽章 */}
      <p className="text-xl font-semibold text-[#1A1A1A] mb-1.5 flex items-center gap-2">
        {user.name ?? "朋友"}
        <span className={`text-[10px] font-light tracking-[0.1em] px-2 py-0.5 rounded-full border ${badge.className}`}>
          {badge.label}
        </span>
      </p>

      {/* 手机号 */}
      <div className="flex items-center gap-1.5 text-[13px] text-[#5E5E5E] mb-1.5">
        <Smartphone className="w-3.5 h-3.5" />
        <span>{maskPhone(user.phone)}</span>
      </div>

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

      {/* 测肤用量：普通/银卡显示终身用量，金卡/钻石不限次显示当日用量 */}
      {testUsage && (
        <p className="text-[12px] text-[#6B5E50] font-light tracking-[0.05em] mb-4">
          {testUsage.unlimited
            ? `测肤不限次（今日已用 ${testUsage.todayUsed}/${testUsage.dailyLimit ?? 10}）`
            : `测肤已用 ${testUsage.totalUsed} / 共 ${testUsage.lifetimeLimit ?? 10} 次`}
        </p>
      )}

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

      {/* 会员中心入口：淡入会员中心视图（我的 / 会员 / 积分商城） */}
      <button
        onClick={onOpenCenter}
        className="group w-full flex items-center justify-between px-4 py-3 mb-6 rounded-2xl border border-brand-charcoal/[0.08] bg-white/70 text-[13px] tracking-[0.05em] text-[#5E5E5E] hover:text-brand-charcoal hover:border-brand-charcoal/20 transition-colors cursor-pointer"
      >
        <span className="inline-flex items-center gap-2">
          <Crown className="w-4 h-4" />
          会员中心
        </span>
        <ChevronRight className="w-4 h-4 text-brand-charcoal/65 transition-transform duration-300 group-hover:translate-x-0.5" />
      </button>

      {/* 退出登录 */}
      <button
        onClick={onRequestLogout}
        className="inline-flex items-center gap-2 text-[13px] tracking-[0.05em] text-[#6B5E50] hover:text-[#1A1A1A] transition-colors cursor-pointer"
      >
        <LogOut className="w-4 h-4" strokeWidth={1.5} />
        退出登录
      </button>
    </div>
  );
}
