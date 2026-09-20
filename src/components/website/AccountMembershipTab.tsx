"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Crown, RefreshCw, Sparkles } from "lucide-react";
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
 * 会员等级区（已并入「我的」页，桌面端为右列）：当前等级卡 + 升级进度 + 全档权益列表。
 * 由 AccountModal 在「我的」页首次激活时随 AccountMyTab 一起挂载；中心视图保持挂载，
 * root ⇄ center 往返不会重复拉取，重新打开弹层时才重新挂载刷新。
 */
export function AccountMembershipTab({ onRequestLogin }: { onRequestLogin: () => void }) {
  const [data, setData] = useState<MembershipData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  // 会话过期（BFF 401）：与业务错误区分，给登录引导而非「重试」
  const [sessionExpired, setSessionExpired] = useState(false);
  // 权益列表折叠：默认仅当前等级展开，其余收起（记录用户的手动覆盖）
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});

  // 卸载守卫：切账号/关闭面板时，晚到的响应不再 setState（与 AccountMyTab 的 cancelled 标记同义）
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 请求进行中：重试按钮防连点（并发去重）
  const inFlightRef = useRef(false);

  const load = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(false);
    fetch("/api/account/membership")
      .then((r) => {
        if (r.status === 401) throw new Error("unauthorized");
        if (!r.ok) throw new Error(`membership ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!mountedRef.current) return;
        setData(d as MembershipData);
        setError(false);
        setSessionExpired(false);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        if (err instanceof Error && err.message === "unauthorized") setSessionExpired(true);
        else setError(true);
      })
      .finally(() => {
        inFlightRef.current = false;
        if (mountedRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

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

  if (error || sessionExpired || !data) {
    return (
      <div className="w-full flex flex-col items-center py-10">
        <p className="text-[13px] text-[#6B5E50] mb-4">
          {sessionExpired ? "登录状态已过期，请重新登录后查看会员信息" : "会员信息加载失败"}
        </p>
        {sessionExpired ? (
          <button
            type="button"
            onClick={onRequestLogin}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-white bg-[var(--color-brand-cocoa)] hover:bg-[#4a3a2c] transition-colors cursor-pointer"
          >
            重新登录
          </button>
        ) : (
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-brand-charcoal border border-brand-charcoal/20 hover:bg-brand-charcoal/[0.04] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重试
          </button>
        )}
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
          // 默认展开当前等级；用户手动开合后以覆盖值为准
          const expanded = expandedOverrides[lv.level] ?? isCurrent;
          const panelId = `membership-benefits-${lv.level}`;
          return (
            <section
              key={lv.level}
              className={`rounded-2xl border px-5 py-4 ${
                isCurrent
                  ? "border-[#C9A86C]/50 bg-[#C9A86C]/[0.06]"
                  : "border-brand-charcoal/[0.08] bg-white/70"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedOverrides((prev) => ({ ...prev, [lv.level]: !expanded }))
                }
                aria-expanded={expanded}
                aria-controls={panelId}
                className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
              >
                <span className={`text-[10px] font-light tracking-[0.1em] px-2 py-0.5 rounded-full border ${lv.colorClass ?? lvBadge.className}`}>
                  {lv.name}
                </span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-light text-brand-charcoal/45 truncate">
                    {lv.maxSpent != null
                      ? `消费 ${formatYuan(lv.minSpent)} - ${formatYuan(lv.maxSpent)}`
                      : lv.minSpent > 0
                        ? `消费满 ${formatYuan(lv.minSpent)}`
                        : "注册即享"}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 text-brand-charcoal/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
              {expanded && (
                <ul id={panelId} className="mt-2.5 flex flex-col gap-2">
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
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
