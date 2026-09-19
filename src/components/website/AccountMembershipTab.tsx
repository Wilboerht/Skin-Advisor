"use client";

import { useEffect, useState } from "react";
import { Crown, RefreshCw, Sparkles } from "lucide-react";
import { getMemberBadge } from "@/components/website/member-badges";

/** GET /api/account/membership 响应结构（BFF 契约） */
interface MembershipBenefit {
  icon: string;
  title: string;
  desc: string;
}

interface MembershipLevelInfo {
  level: string;
  name: string;
  benefits: MembershipBenefit[];
  minSpent: number;
  maxSpent?: number;
  colorClass?: string;
}

interface MembershipData {
  membershipLevel: string;
  memberId: string;
  totalSpent: number;
  currentLevel: MembershipLevelInfo | null;
  nextLevel: {
    level: string;
    name: string;
    minSpent: number;
    spentNeeded: number;
    progress: number;
  } | null;
  allLevels: MembershipLevelInfo[];
}

function formatYuan(n: number) {
  return `¥${n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

/** progress 契约未约定 0-1 还是 0-100，兼容两种 */
function progressPercent(progress: number) {
  const p = progress <= 1 ? progress * 100 : progress;
  return Math.min(100, Math.max(0, Math.round(p)));
}

/**
 * 「会员」tab：当前等级卡 + 升级进度 + 全档权益列表。
 * 由 AccountModal 在 tab 首次激活时才挂载，挂载即拉取（不预取）。
 */
export function AccountMembershipTab() {
  const [data, setData] = useState<MembershipData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(false);
    fetch("/api/account/membership")
      .then((r) => {
        if (!r.ok) throw new Error(`membership ${r.status}`);
        return r.json();
      })
      .then((d) => setData(d as MembershipData))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    // 骨架屏：等级卡 + 进度条 + 权益行
    return (
      <div className="w-full animate-pulse" aria-busy="true" aria-label="会员信息加载中">
        <div className="h-28 rounded-2xl bg-brand-charcoal/[0.06] mb-4" />
        <div className="h-10 rounded-xl bg-brand-charcoal/[0.05] mb-6" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-brand-charcoal/[0.04] mb-3" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full flex flex-col items-center py-10">
        <p className="text-[13px] text-[#6B5E50] mb-4">会员信息加载失败</p>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-brand-charcoal border border-brand-charcoal/20 hover:bg-brand-charcoal/[0.04] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          重试
        </button>
      </div>
    );
  }

  const badge = getMemberBadge(data.membershipLevel);

  return (
    <div className="w-full">
      {/* 当前等级卡 */}
      <div className="rounded-2xl border border-brand-charcoal/[0.08] bg-white/70 px-5 py-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] tracking-[0.05em] text-[#5E5E5E]">
            <Crown className="w-4 h-4" />
            当前等级
          </span>
          <span className={`text-[10px] font-light tracking-[0.1em] px-2 py-0.5 rounded-full border ${badge.className}`}>
            {data.currentLevel?.name ?? badge.label}
          </span>
        </div>
        <p className="text-[12px] font-light text-brand-charcoal/55 tracking-[0.03em]">
          会员号 {data.memberId} · 累计消费 {formatYuan(data.totalSpent)}
        </p>
      </div>

      {/* 升级进度：已到顶档时不渲染 */}
      {data.nextLevel && (
        <div className="rounded-2xl border border-brand-charcoal/[0.08] bg-white/70 px-5 py-4 mb-6">
          <div className="flex items-center justify-between mb-2 text-[12px]">
            <span className="text-[#5E5E5E] tracking-[0.05em]">
              再消费 {formatYuan(data.nextLevel.spentNeeded)} 升级{data.nextLevel.name}
            </span>
            <span className="text-brand-charcoal/45">{progressPercent(data.nextLevel.progress)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressPercent(data.nextLevel.progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 rounded-full bg-brand-charcoal/[0.08] overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-[#C9A86C] transition-[width] duration-500"
              style={{ width: `${progressPercent(data.nextLevel.progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* 全档权益 */}
      <h3 className="text-[13px] font-medium text-[#1A1A1A] tracking-[0.05em] mb-3 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-brand-charcoal/50" />
        会员权益
      </h3>
      <div className="flex flex-col gap-3">
        {data.allLevels.map((lv) => {
          const lvBadge = getMemberBadge(lv.level);
          const isCurrent = lv.level === data.membershipLevel;
          return (
            <section
              key={lv.level}
              className={`rounded-2xl border px-5 py-4 ${
                isCurrent
                  ? "border-[#C9A86C]/50 bg-[#C9A86C]/[0.06]"
                  : "border-brand-charcoal/[0.08] bg-white/70"
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className={`text-[10px] font-light tracking-[0.1em] px-2 py-0.5 rounded-full border ${lv.colorClass ?? lvBadge.className}`}>
                  {lv.name}
                </span>
                <span className="text-[11px] font-light text-brand-charcoal/45">
                  {lv.maxSpent != null
                    ? `消费 ${formatYuan(lv.minSpent)} - ${formatYuan(lv.maxSpent)}`
                    : lv.minSpent > 0
                      ? `消费满 ${formatYuan(lv.minSpent)}`
                      : "注册即享"}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {lv.benefits.map((b, i) => (
                  <li key={`${b.title}-${i}`} className="flex items-start gap-2.5">
                    <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-brand-charcoal/[0.05] text-[13px] leading-none">
                      {b.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] text-[#1A1A1A] tracking-[0.03em]">{b.title}</p>
                      <p className="text-[11px] font-light text-brand-charcoal/50 leading-relaxed">{b.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
