"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  History,
  Loader2,
  LogIn,
  NotebookPen,
  TrendingUp,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { TestHistoryList, type HistorySession } from "@/components/website/TestHistoryList";
import { KineticBackground } from "@/components/website/KineticBackground";
import { DiaryTimeline, type DiaryEntry } from "./DiaryTimeline";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

interface TrendsData {
  dates: string[];
  scores: number[];
}

/** 测肤记录模态框：内嵌共享的 TestHistoryList */
function TestHistoryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
          tabIndex={-1}
          className="fixed inset-0 z-[var(--z-modal)] flex items-end md:items-center justify-center"
        >
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#1A1A1A]/30 backdrop-blur-sm"
          />
          <m.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full md:max-w-2xl max-h-[85dvh] bg-[#FDFBF7] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col motion-reduce:transition-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 md:px-8 pt-6 pb-4 border-b border-brand-charcoal/[0.06] shrink-0">
              <h2 id="history-modal-title" className="text-lg md:text-xl font-serif text-brand-charcoal">
                测肤记录
              </h2>
              <button
                onClick={onClose}
                aria-label="关闭"
                className="w-10 h-10 flex items-center justify-center rounded-full text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-charcoal/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-6 md:px-8 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
              <TestHistoryList />
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** 测肤趋势迷你折线图（纯 SVG，无图表库依赖） */
function TrendChart({ trends }: { trends: TrendsData }) {
  const W = 320;
  const H = 120;
  const PAD_X = 20;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 26;
  const min = Math.min(...trends.scores);
  const max = Math.max(...trends.scores);
  // 评分域上下留余量，避免折线贴边；全相等时给固定幅度
  const lo = Math.max(0, min - 5);
  const hi = Math.min(100, max === min ? min + 10 : max + 5);

  const points = trends.scores.map((score, i) => {
    const x = PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, trends.scores.length - 1);
    const y = PAD_TOP + ((hi - score) / (hi - lo)) * (H - PAD_TOP - PAD_BOTTOM);
    return { x, y, score, date: trends.dates[i] };
  });
  const path = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="近几次测肤综合评分趋势">
        <polyline
          points={path}
          fill="none"
          stroke="#00263E"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#FDFBF7" stroke="#00263E" strokeWidth="2" />
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fill="#00263E">
              {p.score}
            </text>
            <text x={p.x} y={H - 8} textAnchor="middle" fontSize="9" fill="#8A8A8A">
              {new Date(p.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-[12px] text-[#8A8A8A] font-light">近 {trends.scores.length} 次测肤综合评分</p>
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

  const [showHistoryModal, setShowHistoryModal] = useState(false);

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

  return (
    <div className="min-h-dvh text-[#1A1A1A] pb-dock">
      {/* Kinetic 背景：与首页一致的米白底 + 水印 */}
      <KineticBackground />
      <div className="relative z-20 max-w-2xl mx-auto px-6 pt-12 md:pt-16">
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
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 text-brand-charcoal/40 animate-spin" />
          </div>
        ) : !user ? (
          /* 未登录引导卡 */
          <div className="rounded-3xl border border-brand-charcoal/[0.08] bg-gradient-to-br from-white to-[#FBF7EE] shadow-[0_8px_24px_rgba(0,38,62,0.06)] p-8 md:p-10 text-center">
            <p className="text-[15px] text-brand-charcoal mb-2">登录后查看你的护肤档案</p>
            <p className="text-[13px] text-brand-charcoal/60 font-light mb-6">
              测肤趋势与护肤历程都将在登录后开启
            </p>
            <button
              onClick={() => openAuthModal("login")}
              className="inline-flex items-center gap-2 h-10 px-6 rounded-full bg-brand-charcoal text-white text-[13px] tracking-[0.08em] font-light transition-opacity hover:opacity-90 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              登录 / 注册
            </button>
          </div>
        ) : (
          <>
            {/* 测肤趋势区 */}
            <section className="rounded-3xl border border-brand-charcoal/[0.08] bg-gradient-to-br from-white to-[#FBF7EE] shadow-[0_8px_24px_rgba(0,38,62,0.06)] p-6 md:p-8 mb-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-charcoal/60" strokeWidth={1.5} />
                  测肤趋势
                </h2>
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 rounded-full border border-brand-charcoal/20 text-brand-charcoal/70 text-[12px] font-light tracking-[0.05em] transition-all duration-300 hover:border-brand-charcoal/50 hover:text-brand-charcoal cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" strokeWidth={1.5} />
                  测肤记录
                </button>
              </div>

              {!trendsLoaded || !entriesLoaded ? (
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

            {/* 历程时间线（PRD v1.5）：日记打卡 + 测肤里程碑按日合并倒序 */}
            <section className="mb-8">
              <h2 className="text-base md:text-lg font-semibold mb-5 flex items-center gap-2">
                <NotebookPen className="w-4 h-4 text-brand-charcoal/60" strokeWidth={1.5} />
                护肤历程
              </h2>
              <DiaryTimeline
                entries={entries}
                tests={tests}
                loading={!entriesLoaded || !testsLoaded}
              />
            </section>
          </>
        )}
      </div>

      {/* 测肤记录模态框（仅登录后可达） */}
      <TestHistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} />
    </div>
  );
}
