"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { Loader2, NotebookPen, ScanFace, Smile, TrendingUp, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import type { HistorySession } from "@/components/website/TestHistoryList";
import { DiaryTimeline, type DiaryEntry } from "@/components/website/DiaryTimeline";
import { TrendChart, type TrendsData } from "@/components/website/TrendChart";
import { CheckInModal } from "@/components/website/CheckInModal";
import { TestHistoryModal } from "@/components/website/TestHistoryModal";
import { useDiaryModal } from "@/components/website/DiaryModalContext";

const TESTS_PAGE_SIZE = 50;

/** 游客视图的装饰性示意曲线（无数值，不代表真实数据） */
function GuestTrendCurve() {
  return (
    <svg viewBox="0 0 200 70" className="w-full h-auto" aria-hidden="true">
      {[18, 36, 54].map((y) => (
        <line key={y} x1="12" y1={y} x2="188" y2={y} stroke="#00263E" strokeOpacity="0.07" strokeDasharray="2 4" />
      ))}
      <path
        d="M12,56 C42,54 56,36 80,38 S132,54 150,30 S178,20 188,18"
        fill="none"
        stroke="#00263E"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="5 6"
        strokeLinecap="round"
      />
      <path
        d="M12,62 C48,60 66,48 94,50 S146,58 172,40"
        fill="none"
        stroke="#00263E"
        strokeOpacity="0.12"
        strokeWidth="2"
        strokeDasharray="4 6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * DiaryModal — 「护肤档案」弹层（原独立页 /diary，2026-09 改为全局弹层）
 * 未登录：紧凑登录引导视图（示意曲线 + 功能胶囊 + CTA）；
 * 已登录：测肤趋势 + 护肤历程时间线；打卡/全部记录为二级弹层（sheet 叠 sheet）。
 * 容器/动效与 AccountModal 全站模态框对齐。
 */
export function DiaryModal() {
  const { isOpen, closeDiaryModal } = useDiaryModal();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [trendsLoaded, setTrendsLoaded] = useState(false);
  const [tests, setTests] = useState<HistorySession[]>([]);
  const [testsLoaded, setTestsLoaded] = useState(false);
  const [testsTotal, setTestsTotal] = useState(0);
  const [testsLoadingMore, setTestsLoadingMore] = useState(false);
  const testsLoadedRef = useRef(0);

  // 打卡弹层：existing 为 null 表示新建当日记录
  const [checkIn, setCheckIn] = useState<{ open: boolean; existing: DiaryEntry | null }>({
    open: false,
    existing: null,
  });
  // 全部测肤记录弹层
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const modalRef = useFocusTrap<HTMLDivElement>(
    isOpen && !checkIn.open && !showHistoryModal,
    closeDiaryModal
  );
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  // 打开时拉取（每次打开刷新；未登录直接跳过走游客视图）
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

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;

    setEntries([]);
    setEntriesLoaded(false);
    setTrends(null);
    setTrendsLoaded(false);
    setTests([]);
    setTestsLoaded(false);
    testsLoadedRef.current = 0;

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

    fetch(`/api/advisor/history?page=1&limit=${TESTS_PAGE_SIZE}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        const history: HistorySession[] = data.history ?? [];
        setTests(history);
        testsLoadedRef.current = history.length;
        setTestsTotal(data.pagination?.total ?? 0);
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
  }, [isOpen, user]);

  // 时间线「加载更早」：分页追加（sessionId 去重）
  const loadMoreTests = useCallback(async () => {
    if (testsLoadingMore) return;
    setTestsLoadingMore(true);
    try {
      const page = Math.floor(testsLoadedRef.current / TESTS_PAGE_SIZE) + 1;
      const res = await fetch(`/api/advisor/history?page=${page}&limit=${TESTS_PAGE_SIZE}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const more: HistorySession[] = data.history ?? [];
      setTests((prev) => {
        const seen = new Set(prev.map((t) => t.sessionId));
        return [...prev, ...more.filter((t) => !seen.has(t.sessionId))];
      });
      testsLoadedRef.current += more.length;
      setTestsTotal(data.pagination?.total ?? 0);
    } catch (e) {
      console.error("Load more tests error:", e);
    } finally {
      setTestsLoadingMore(false);
    }
  }, [testsLoadingMore]);

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="diary-modal-title"
            tabIndex={-1}
            className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            {/* 背景遮罩 */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDiaryModal}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            {/* 弹窗主体：移动端底部升起，桌面端居中 */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full sm:max-w-xl max-h-[86dvh] bg-[#FDFBF7] rounded-t-[28px] sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 标题栏 */}
              <div className="flex items-center justify-between shrink-0 px-6 md:px-8 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] sm:pt-6 pb-4 border-b border-brand-charcoal/[0.06]">
                <h2
                  id="diary-modal-title"
                  className="text-xl font-serif font-light text-brand-charcoal tracking-[0.08em]"
                >
                  护肤档案
                </h2>
                <button
                  onClick={closeDiaryModal}
                  aria-label="关闭"
                  className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* 内容区（可滚动） */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-5 md:px-7 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
                {!user ? (
                  /* ===== 游客：登录引导视图 ===== */
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="max-w-[220px] w-full mb-4">
                      <GuestTrendCurve />
                    </div>
                    <h3 className="text-2xl font-serif font-light text-brand-charcoal tracking-[0.02em] mb-3">
                      你的护肤档案
                    </h3>
                    <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] text-center mb-5">
                      每次测肤自动记录，趋势与历程都在这里
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
                      {[
                        { icon: TrendingUp, label: "测肤趋势" },
                        { icon: ScanFace, label: "里程碑记录" },
                        { icon: Smile, label: "每日打卡" },
                      ].map((f) => {
                        const Icon = f.icon;
                        return (
                          <span
                            key={f.label}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 border border-brand-charcoal/[0.08] text-[12px] text-brand-charcoal/60 font-light tracking-[0.04em]"
                          >
                            <Icon className="w-3.5 h-3.5 text-brand-charcoal/45" strokeWidth={1.5} />
                            {f.label}
                          </span>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => openAuthModal("login")}
                      className="inline-flex items-center justify-center px-10 py-3 rounded-full bg-[#5c4937] text-[#FDFBF7] text-[13px] tracking-[0.12em] font-light cursor-pointer transition-colors duration-300 hover:bg-[#4a3a2c] mb-4"
                    >
                      登录 / 注册
                    </button>
                    <Link
                      href="/questions"
                      className="text-[13px] text-brand-charcoal/60 font-light tracking-[0.06em] hover:text-brand-charcoal transition-colors"
                    >
                      先去测肤，稍后再登录 →
                    </Link>
                  </div>
                ) : (
                  /* ===== 登录：趋势 + 时间线 ===== */
                  <div>
                    {/* 测肤趋势 */}
                    <section className="rounded-3xl border border-brand-charcoal/[0.08] bg-gradient-to-br from-white to-[#FBF7EE] shadow-[0_8px_24px_rgba(0,38,62,0.06)] p-5 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[15px] font-semibold flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-brand-charcoal/60" strokeWidth={1.5} />
                          测肤趋势
                        </h3>
                        <span className="flex items-center gap-3">
                          {trends && (
                            <span className="text-[11px] text-brand-charcoal/45 font-light tracking-[0.1em]">
                              近 {trends.scores.length} 次
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowHistoryModal(true)}
                            className="text-[12px] text-brand-charcoal/60 font-light tracking-[0.05em] hover:text-brand-charcoal transition-colors cursor-pointer"
                          >
                            全部记录 →
                          </button>
                        </span>
                      </div>

                      {!trendsLoaded || !entriesLoaded ? (
                        <div className="h-32 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-brand-charcoal/30 animate-spin" />
                        </div>
                      ) : trends ? (
                        <TrendChart trends={trends} />
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-[14px] text-brand-charcoal/70 mb-1.5">完成 2 次测肤后解锁趋势</p>
                          <p className="text-[12px] text-brand-charcoal/50 font-light mb-4">
                            定期测肤，看见肌肤的真实变化
                          </p>
                          <Link
                            href="/questions"
                            className="inline-flex items-center justify-center px-5 h-9 rounded-full bg-brand-charcoal text-white text-[12px] tracking-[0.08em] font-light transition-opacity hover:opacity-90"
                          >
                            去测肤
                          </Link>
                        </div>
                      )}
                    </section>

                    {/* 护肤历程 */}
                    <section>
                      <h3 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
                        <NotebookPen className="w-4 h-4 text-brand-charcoal/60" strokeWidth={1.5} />
                        护肤历程
                      </h3>
                      <DiaryTimeline
                        entries={entries}
                        tests={tests}
                        loading={!entriesLoaded || !testsLoaded}
                        onCheckIn={(existing) => setCheckIn({ open: true, existing })}
                        hasMoreTests={tests.length < testsTotal}
                        testsLoadingMore={testsLoadingMore}
                        onLoadMoreTests={loadMoreTests}
                      />
                    </section>
                  </div>
                )}
              </div>
            </m.div>

            {/* 二级弹层：打卡 / 全部记录（sheet 叠 sheet，DOM 在后自然置顶） */}
            <CheckInModal
              isOpen={checkIn.open && !!user}
              existing={checkIn.existing}
              onClose={() => setCheckIn((s) => ({ ...s, open: false }))}
              onSaved={refreshEntries}
            />
            <TestHistoryModal isOpen={showHistoryModal && !!user} onClose={() => setShowHistoryModal(false)} />
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
