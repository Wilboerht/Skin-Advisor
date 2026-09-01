"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogIn, NotebookPen, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { KineticBackground } from "@/components/website/KineticBackground";
import { HidePageScrollbar } from "@/components/website/HidePageScrollbar";
import type { HistorySession } from "@/components/website/TestHistoryList";
import { DiaryTimeline, type DiaryEntry } from "./DiaryTimeline";
import { CheckInModal } from "./CheckInModal";

interface TrendsData {
  dates: string[];
  scores: number[];
}

/** 测肤趋势图（纯 SVG，无图表库依赖）：平滑曲线 + 渐变面积 + 网格刻度 + 最新评分摘要 */
function TrendChart({ trends }: { trends: TrendsData }) {
  const W = 640;
  const H = 200;
  const PAD_L = 40;
  const PAD_R = 20;
  const PAD_TOP = 24;
  const PAD_BOTTOM = 32;

  const scores = trends.scores;
  const n = scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  // Y 域对齐到 10 的整倍并留余量，刻度才有"数据感"
  let lo = Math.max(0, Math.floor((min - 8) / 10) * 10);
  let hi = Math.min(100, Math.ceil((max + 8) / 10) * 10);
  if (hi - lo < 20) hi = Math.min(100, lo + 20);
  if (hi - lo < 20) lo = Math.max(0, hi - 20);

  const gridValues = [lo, Math.round((lo + hi) / 2 / 10) * 10, hi];
  const yOf = (v: number) => PAD_TOP + ((hi - v) / (hi - lo)) * (H - PAD_TOP - PAD_BOTTOM);

  const points = scores.map((score, i) => ({
    x: PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(1, n - 1),
    y: yOf(score),
    score,
    date: trends.dates[i],
  }));

  // Catmull-Rom 平滑曲线
  const smoothPath = (pts: { x: number; y: number }[]): string => {
    if (pts.length < 2) return "";
    if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[n - 1].x},${H - PAD_BOTTOM} L ${points[0].x},${H - PAD_BOTTOM} Z`;

  const latest = scores[n - 1];
  const delta = n >= 2 ? latest - scores[n - 2] : 0;

  return (
    <div>
      {/* 摘要：最新评分 + 与上次差值 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[11px] tracking-[0.15em] text-brand-charcoal/45 font-light mb-1">
            最新综合评分
          </p>
          <p className="text-3xl md:text-4xl font-serif font-light text-brand-charcoal leading-none">
            {latest}
            <span className="text-sm text-brand-charcoal/40 ml-1.5">分</span>
          </p>
        </div>
        {delta !== 0 && (
          <span
            className={`text-[12px] font-light px-2.5 py-1 rounded-full ${
              delta > 0 ? "bg-[#4C8055]/10 text-[#4C8055]" : "bg-[#D44C47]/10 text-[#D44C47]"
            }`}
          >
            较上次 {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="近几次测肤综合评分趋势">
        <defs>
          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00263E" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#00263E" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 横向网格线 + 左侧刻度 */}
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              y1={yOf(v)}
              x2={W - PAD_R}
              y2={yOf(v)}
              stroke="#00263E"
              strokeOpacity="0.07"
              strokeDasharray="3 5"
            />
            <text x={PAD_L - 8} y={yOf(v) + 3.5} textAnchor="end" fontSize="10.5" fill="#8A8A8A">
              {v}
            </text>
          </g>
        ))}

        {/* 面积 + 曲线 */}
        <path d={areaPath} fill="url(#trendArea)" />
        <path
          d={linePath}
          fill="none"
          stroke="#00263E"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 数据点 + 数值 + 日期（点多时仅标最新值、隔点标日期，避免拥挤） */}
        {points.map((p, i) => {
          const isLatest = i === n - 1;
          const showScore = n <= 6 || isLatest;
          const showDate = n <= 6 || i % 2 === 0 || isLatest;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isLatest ? 4.5 : 3}
                fill={isLatest ? "#00263E" : "#FDFBF7"}
                stroke="#00263E"
                strokeWidth="2"
              />
              {showScore && (
                <text
                  x={i === 0 ? p.x + 7 : p.x}
                  y={p.y - 9}
                  textAnchor={i === 0 ? "start" : "middle"}
                  fontSize="11"
                  fontWeight={isLatest ? 600 : 400}
                  fill="#00263E"
                >
                  {p.score}
                </text>
              )}
              {showDate && (
                <text x={p.x} y={H - 6} textAnchor="middle" fontSize="10" fill="#8A8A8A">
                  {new Date(p.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[12px] text-[#8A8A8A] font-light">近 {n} 次测肤综合评分</p>
    </div>
  );
}

export default function DiaryClient() {
  const { user, loading: authLoading } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [trendsLoaded, setTrendsLoaded] = useState(false);
  // 测肤里程碑（时间线合并事件用，取最近 50 条覆盖近 90 天）
  const [tests, setTests] = useState<HistorySession[]>([]);
  const [testsLoaded, setTestsLoaded] = useState(false);

  // 打卡弹层：existing 为 null 表示新建当日记录
  const [checkIn, setCheckIn] = useState<{ open: boolean; existing: DiaryEntry | null }>({
    open: false,
    existing: null,
  });

  // 拉取日记列表（打卡保存后复用刷新）
  const refreshEntries = useCallback(() => {
    fetch("/api/user/diary")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        setEntries(data.data ?? []);
        setEntriesLoaded(true);
      })
      .catch((e) => {
        console.error("Diary fetch error:", e);
        setEntriesLoaded(true);
      });
  }, []);

  // 已登录后拉取日记与趋势
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    fetch("/api/user/diary")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        setEntries(data.data ?? []);
        setEntriesLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Diary fetch error:", e);
        setEntriesLoaded(true);
      });

    fetch("/api/user/skin-trends")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        setTrends(data.data ?? null); // 测肤 < 2 次时后端返回 data: null
        setTrendsLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Trends fetch error:", e);
        setTrendsLoaded(true);
      });

    fetch("/api/advisor/history?page=1&limit=50")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        setTests(data.history ?? []);
        setTestsLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Test history fetch error:", e);
        setTestsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // 未登录展示的模拟数据（模糊遮罩下仅作版式示意，非真实数据）
  const dayStr = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const mockTrends: TrendsData = {
    dates: [dayStr(26), dayStr(24), dayStr(21), dayStr(19), dayStr(16), dayStr(14), dayStr(12), dayStr(9), dayStr(7), dayStr(5), dayStr(3), dayStr(1)],
    scores: [72, 75, 71, 78, 76, 80, 77, 82, 79, 83, 81, 84],
  };
  const mockEntries: DiaryEntry[] = [
    { id: "mock-1", date: `${dayStr(1)}T00:00:00.000Z`, skinState: "good", tags: [], note: "AI 测肤 · 综合评分 82 分 · 混合肌" },
    { id: "mock-2", date: `${dayStr(3)}T00:00:00.000Z`, skinState: "normal", tags: [], note: "AI 测肤 · 综合评分 74 分 · 混合肌" },
  ];
  const mockTests: HistorySession[] = [
    { sessionId: "mock", completedAt: `${dayStr(1)}T10:00:00.000Z`, analysisResult: { faceAnalysis: { overallScore: 82 } } },
  ];

  return (
    <div className="min-h-dvh text-[#1A1A1A] pb-dock">
      {/* Kinetic 背景：与首页一致的米白底 + 水印 */}
      <KineticBackground />
      {/* 隐藏页面滚动条（保留滚动） */}
      <HidePageScrollbar />
      <div className="relative z-20 max-w-3xl mx-auto px-6 pt-12 md:pt-16">
        {/* 页面标题 */}
        <header className="mb-8 md:mb-10">
          <h1 className="text-2xl md:text-3xl font-serif font-light text-brand-charcoal tracking-[0.02em]">
            护肤档案
          </h1>
          <p className="mt-2 text-[13px] md:text-sm text-brand-charcoal/60 font-light tracking-[0.06em]">
            每次测肤后，自动记录肌肤的真实状态
          </p>
        </header>

        {authLoading ? (
          // 登录态探测期间的骨架屏（游客预览/真实数据待 /api/auth/me 返回后一次性切换，避免闪空）
          <div className="animate-pulse" aria-hidden="true">
            <div className="rounded-3xl border border-brand-charcoal/[0.08] bg-white/60 h-[260px] mb-8" />
            <div className="h-5 w-28 rounded bg-brand-charcoal/[0.06] mb-5" />
            <div className="space-y-2.5">
              <div className="h-[54px] rounded-2xl bg-brand-charcoal/[0.05]" />
              <div className="h-[54px] rounded-2xl bg-brand-charcoal/[0.05]" />
              <div className="h-[54px] rounded-2xl bg-brand-charcoal/[0.05]" />
            </div>
          </div>
        ) : (
          <>
            {/* 测肤趋势区（未登录：模拟数据清晰展示，作为"试读"） */}
            <section
              className="rounded-3xl border border-brand-charcoal/[0.08] bg-gradient-to-br from-white to-[#FBF7EE] shadow-[0_8px_24px_rgba(0,38,62,0.06)] p-6 md:p-8 mb-8"
              {...(!user ? { "aria-label": "测肤趋势预览（模拟数据）" } : {})}
            >
              <div className="mb-5">
                <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-charcoal/60" strokeWidth={1.5} />
                  测肤趋势
                  {!user && (
                    <span className="text-[11px] font-light px-2 py-0.5 rounded-full border border-brand-charcoal/15 text-brand-charcoal/45 tracking-[0.1em]">
                      示例数据
                    </span>
                  )}
                </h2>
              </div>

              {!user ? (
                <div className="pointer-events-none select-none" aria-hidden="true">
                  <TrendChart trends={mockTrends} />
                </div>
              ) : !trendsLoaded || !entriesLoaded ? (
                <div className="h-32 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-brand-charcoal/30 animate-spin" />
                </div>
              ) : trends ? (
                <TrendChart trends={trends} />
              ) : (
                <div className="text-center py-8">
                  <p className="text-[14px] text-brand-charcoal/70 mb-1.5">完成 2 次测肤后解锁趋势</p>
                  <p className="text-[12px] text-brand-charcoal/50 font-light">
                    定期测肤，看见肌肤的真实变化
                  </p>
                </div>
              )}
            </section>

            {/* 历程时间线（未登录：模拟数据，向下渐隐"试读"） */}
            <section
              className={
                !user
                  ? "mb-8 pointer-events-none select-none max-h-[360px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_0%,black_25%,transparent_80%)]"
                  : "mb-8"
              }
              aria-hidden={!user || undefined}
            >
              <h2 className="text-base md:text-lg font-semibold mb-5 flex items-center gap-2">
                <NotebookPen className="w-4 h-4 text-brand-charcoal/60" strokeWidth={1.5} />
                护肤历程
                {!user && (
                  <span className="text-[11px] font-light px-2 py-0.5 rounded-full border border-brand-charcoal/15 text-brand-charcoal/45 tracking-[0.1em]">
                    示例数据
                  </span>
                )}
              </h2>
              <DiaryTimeline
                entries={user ? entries : mockEntries}
                tests={user ? tests : mockTests}
                loading={user ? !entriesLoaded || !testsLoaded : false}
                onCheckIn={user ? (existing) => setCheckIn({ open: true, existing }) : undefined}
              />
            </section>

            {/* 未登录引导卡：沉底（不重叠），位于渐隐时间线之后 */}
            {!user && (
              <div className="rounded-3xl border border-brand-charcoal/[0.08] bg-white/90 backdrop-blur-md shadow-[0_24px_48px_rgba(0,38,62,0.12)] p-8 md:p-10 text-center max-w-sm mx-auto mb-8">
                <p className="text-[15px] text-brand-charcoal mb-2">登录后查看你的护肤档案</p>
                <p className="text-[13px] text-brand-charcoal/60 font-light mb-6">
                  每次测肤后自动记录，趋势与历程都在这里
                </p>
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => openAuthModal("login")}
                    className="inline-flex items-center gap-2 h-10 px-6 rounded-full bg-brand-charcoal text-white text-[13px] tracking-[0.08em] font-light transition-opacity hover:opacity-90 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    登录 / 注册
                  </button>
                  <Link
                    href="/questions"
                    className="text-[13px] text-brand-charcoal/60 font-light tracking-[0.06em] hover:text-brand-charcoal transition-colors"
                  >
                    先去测肤，稍后再登录 →
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 打卡弹层（仅登录后可达） */}
      <CheckInModal
        isOpen={checkIn.open}
        existing={checkIn.existing}
        onClose={() => setCheckIn((s) => ({ ...s, open: false }))}
        onSaved={refreshEntries}
      />
    </div>
  );
}
