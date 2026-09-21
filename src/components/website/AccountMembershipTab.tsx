"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { ChevronDown, Crown, RefreshCw, Sparkles } from "lucide-react";
import { getMemberBadge } from "@/components/website/member-badges";
import { ACCOUNT_CARD, ACCOUNT_SECTION_TITLE } from "@/components/website/account-styles";
import { POINTS_CHANGED_EVENT } from "@/lib/fetch-client";

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

/** 等级卡（hero）按档位配色：金=品牌金渐变，钻石=深青灰 + 金点缀，银=暖灰，普通=米渐变。
 *  badge=卡内徽章，sub=次要文字，track/fill=进度条轨道/填充 */
interface LevelCardTheme {
  card: string;
  badge: string;
  sub: string;
  track: string;
  fill: string;
}

const GOLD_CARD_THEME: LevelCardTheme = {
  card: "border-transparent bg-gradient-to-br from-[#D4B77A] via-[#C9A86C] to-[#B8975B] text-white",
  badge: "border-white/50 text-white bg-white/10",
  sub: "text-white/80",
  track: "bg-white/25",
  fill: "bg-white/90",
};

const LEVEL_CARD_THEMES: Record<string, LevelCardTheme> = {
  GOLD: GOLD_CARD_THEME,
  ADVANCED: GOLD_CARD_THEME,
  DIAMOND: {
    card: "border-transparent bg-gradient-to-br from-[#00263E] to-[#4A6272] text-white",
    badge: "border-[#C9A86C]/60 text-[#D4B77A] bg-[#C9A86C]/10",
    sub: "text-white/70",
    track: "bg-white/15",
    fill: "bg-[#C9A86C]",
  },
  SILVER: {
    card: "border-transparent bg-gradient-to-br from-[#EDEBE6] to-[#D9D5CE] text-brand-charcoal",
    badge: "border-slate-400/60 text-slate-500 bg-white/40",
    sub: "text-brand-charcoal/60",
    track: "bg-brand-charcoal/[0.1]",
    fill: "bg-[#C9A86C]",
  },
};

const DEFAULT_CARD_THEME: LevelCardTheme = {
  card: "border-transparent bg-gradient-to-br from-[#F5F2ED] to-[#E8E2D9] text-brand-charcoal",
  badge: "border-brand-charcoal/25 text-brand-charcoal/65 bg-white/50",
  sub: "text-brand-charcoal/60",
  track: "bg-brand-charcoal/[0.1]",
  fill: "bg-[#C9A86C]",
};

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

  // 积分余额：与等级/消费同属会员资产，并入等级卡；null = 接口不可用（不展示该行，不闪骨架）
  const [points, setPoints] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetchPoints = () =>
      fetch("/api/account/points")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled) setPoints(typeof d?.available === "number" ? d.available : null); })
        .catch(() => { /* 保留旧值 */ });
    fetchPoints();
    // 打卡实际到账积分后（POINTS_CHANGED_EVENT）静默刷新余额，保持与主站账本一致
    window.addEventListener(POINTS_CHANGED_EVENT, fetchPoints);
    return () => {
      cancelled = true;
      window.removeEventListener(POINTS_CHANGED_EVENT, fetchPoints);
    };
  }, []);

  if (loading) {
    // 骨架屏：等级卡（含进度）+ 权益标题 + 权益行，高度对齐真实内容避免加载完成时跳动
    return (
      <div className="w-full animate-pulse" aria-busy="true" aria-label="会员信息加载中">
        <div className="h-[136px] rounded-2xl bg-brand-charcoal/[0.06] mb-6" />
        <div className="h-6 w-24 rounded-lg bg-brand-charcoal/[0.05] mb-3" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-brand-charcoal/[0.04] mb-3" />
        ))}
      </div>
    );
  }

  if (error || sessionExpired || !data) {
    return (
      <div className="w-full flex flex-col items-center py-10">
        <p className="text-[13px] text-brand-charcoal/60 mb-4">
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
  const cardTheme = LEVEL_CARD_THEMES[data.membershipLevel] ?? DEFAULT_CARD_THEME;

  return (
    <div className="w-full">
      {/* 当前等级卡（hero）：档位渐变底，会员号/累计消费/升级进度并入卡内 */}
      <div className={`rounded-2xl border px-5 py-4 mb-6 shadow-[0_8px_24px_rgba(61,47,37,0.12)] ${cardTheme.card}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`inline-flex items-center gap-1.5 text-[13px] tracking-[0.05em] ${cardTheme.sub}`}>
            <Crown className="w-4 h-4" />
            当前等级
          </span>
          <span className={`text-[11px] font-light tracking-[0.1em] px-2 py-0.5 rounded-full border ${cardTheme.badge}`}>
            {data.currentLevel?.name ?? badge.label}
          </span>
        </div>
        <p className={`text-[12px] font-light tracking-[0.03em] ${cardTheme.sub}`}>
          会员号 {data.memberId} · 累计消费 {formatYuan(data.totalSpent)}
          {typeof points === "number" && ` · 积分余额 ${points}`}
        </p>

        {/* 升级进度：并入等级卡底部；已到顶档时不渲染 */}
        {data.nextLevel && (
          <div className="mt-4">
            <div className={`flex items-center justify-between mb-2 text-[12px] ${cardTheme.sub}`}>
              <span className="tracking-[0.05em]">
                再消费 {formatYuan(data.nextLevel.spentNeeded)} 升级{data.nextLevel.name}
              </span>
              <span>{progressPercent(data.nextLevel.progress)}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progressPercent(data.nextLevel.progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              className={`relative h-1.5 rounded-full overflow-hidden ${cardTheme.track}`}
            >
              <div
                className={`h-full rounded-full ${cardTheme.fill} transition-[width] duration-500`}
                style={{ width: `${progressPercent(data.nextLevel.progress)}%` }}
              />
              {/* 微光流动：与分析加载进度条同款 */}
              <m.div
                aria-hidden="true"
                className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                initial={{ left: "-33%" }}
                animate={{ left: "100%" }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 全档权益 */}
      <h3 className={`${ACCOUNT_SECTION_TITLE} mb-3 flex items-center gap-1.5`}>
        <Sparkles className="w-4 h-4 text-brand-charcoal/50" />
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
              className={
                isCurrent
                  ? "rounded-2xl border border-[#C9A86C]/50 bg-[#C9A86C]/[0.06] px-5 py-4 shadow-[0_2px_12px_rgba(61,47,37,0.05)]"
                  : `${ACCOUNT_CARD} px-5 py-4`
              }
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedOverrides((prev) => ({ ...prev, [lv.level]: !expanded }))
                }
                aria-expanded={expanded}
                aria-controls={panelId}
                className="w-full flex items-center justify-between gap-3 text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30"
              >
                <span className={`text-[11px] font-light tracking-[0.1em] px-2 py-0.5 rounded-full border ${lv.colorClass ?? lvBadge.className}`}>
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
                        <p className="text-[12px] text-brand-charcoal tracking-[0.03em]">{b.title}</p>
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
