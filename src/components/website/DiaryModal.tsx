"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import {
  CalendarCheck,
  ChevronLeft,
  Flame,
  Loader2,
  NotebookPen,
  ScanFace,
  Smile,
  TrendingUp,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import type { HistorySession } from "@/components/website/TestHistoryList";
import { TestHistoryList } from "@/components/website/TestHistoryList";
import { DiaryTimeline, type DiaryEntry } from "@/components/website/DiaryTimeline";
import { DiaryCalendar } from "@/components/website/DiaryCalendar";
import { TrendChart, type TrendsData } from "@/components/website/TrendChart";
import { CheckInModal } from "@/components/website/CheckInModal";
import { useDiaryModal } from "@/components/website/DiaryModalContext";
import { useToast } from "@/components/ui/Toast";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { localDateStr } from "@/lib/local-date";

const TESTS_PAGE_SIZE = 50;
const ENTRIES_PAGE_SIZE = 30;

interface DiarySummary {
  totalCheckins: number;
  currentStreak: number;
  longestStreak: number;
  testCount: number;
}

// 60s 短缓存：趋势与测肤列表重复开关弹层时不重复请求（打卡/删除通过刷新路径绕开）
const SHORT_CACHE_TTL_MS = 60_000;
const shortCache = new Map<string, { ts: number; promise: Promise<Response> }>();
function fetchWithShortCache(url: string): Promise<Response> {
  const hit = shortCache.get(url);
  if (hit && Date.now() - hit.ts < SHORT_CACHE_TTL_MS) return hit.promise;
  const promise = fetch(url);
  shortCache.set(url, { ts: Date.now(), promise });
  return promise;
}

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
 * 已登录：肌肤变化 + 护肤历程时间线；「全部记录」为弹层内视图切换（原内容淡出 → 记录淡入），
 * 打卡保持二级弹层。容器/动效与 AccountModal 全站模态框对齐。
 */
export function DiaryModal() {
  const { isOpen, closeDiaryModal } = useDiaryModal();
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const toast = useToast();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [entriesLoadingMore, setEntriesLoadingMore] = useState(false);
  const [diaryRefreshKey, setDiaryRefreshKey] = useState(0);
  const entriesOffsetRef = useRef(0);
  const [summary, setSummary] = useState<DiarySummary | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [trendsLoaded, setTrendsLoaded] = useState(false);
  const [tests, setTests] = useState<HistorySession[]>([]);
  const [testsLoaded, setTestsLoaded] = useState(false);
  const [testsTotal, setTestsTotal] = useState(0);
  const [testsLoadingMore, setTestsLoadingMore] = useState(false);
  const [testsExhausted, setTestsExhausted] = useState(false);
  const testsLoadedRef = useRef(0);
  const loadedTestIdsRef = useRef<Set<string>>(new Set());
  // 日历热力图
  const [calendarView, setCalendarView] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => localDateStr(new Date()).slice(0, 7));
  const [calendarEntries, setCalendarEntries] = useState<DiaryEntry[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  // 全部记录翻页位置保留
  const [lastHistoryPage, setLastHistoryPage] = useState(1);
  // 删除中条目 id
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 打卡弹层：existing 为 null 表示新建；dateStr 为目标日历日（补打卡为过去日期）
  const [checkIn, setCheckIn] = useState<{ open: boolean; existing: DiaryEntry | null; dateStr: string | null }>({
    open: false,
    existing: null,
    dateStr: null,
  });
  // 视图切换：true=全部记录（同一弹层内内容淡去切换，不开新弹层）
  const [historyView, setHistoryView] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const modalRef = useFocusTrap<HTMLDivElement>(isOpen && !checkIn.open, closeDiaryModal);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  // 切换视图时内容区回到顶部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [historyView]);

  // 日记列表分页加载：offset 分页，append 时按 id 去重
  const loadEntries = useCallback(async (offset: number, limit: number, append: boolean) => {
    const res = await fetch(`/api/user/diary?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list: DiaryEntry[] = data.data ?? [];
    const total: number = data.pagination?.total ?? 0;
    setEntries((prev) => {
      if (!append) return list;
      const seen = new Set(prev.map((e) => e.id));
      return [...prev, ...list.filter((e) => !seen.has(e.id))];
    });
    setEntriesTotal(total);
    entriesOffsetRef.current = offset + list.length;
  }, []);

  // 里程碑统计（连续/累计打卡、测肤次数）
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/user/diary?summary=1");
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data.summary ?? null);
    } catch (e) {
      console.error("Diary summary fetch error:", e);
    }
  }, []);

  // 打卡保存/删除后刷新：带回已加载过的条目数量 + 折叠回"近 30 天"（refreshKey 自增触发时间线收起）
  const refreshEntries = useCallback(() => {
    const limit = Math.max(ENTRIES_PAGE_SIZE, entriesOffsetRef.current + ENTRIES_PAGE_SIZE);
    loadEntries(0, limit, false)
      .then(() => {
        setEntriesLoaded(true);
        setDiaryRefreshKey((k) => k + 1);
      })
      .catch((e) => {
        console.error("Diary fetch error:", e);
        setEntriesLoaded(true);
      });
    // 里程碑统计与日历视图同步刷新
    loadSummary();
    setCalendarRefreshKey((k) => k + 1);
  }, [loadEntries, loadSummary]);

  // 时间线"加载更早"：追加下一页日记
  const loadMoreEntries = useCallback(async () => {
    if (entriesLoadingMore) return;
    setEntriesLoadingMore(true);
    try {
      await loadEntries(entriesOffsetRef.current, ENTRIES_PAGE_SIZE, true);
    } catch (e) {
      console.error("Load more entries error:", e);
    } finally {
      setEntriesLoadingMore(false);
    }
  }, [entriesLoadingMore, loadEntries]);

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;

    setEntries([]);
    setEntriesLoaded(false);
    entriesOffsetRef.current = 0;
    setEntriesTotal(0);
    setSummary(null);
    setTrends(null);
    setTrendsLoaded(false);
    setTests([]);
    setTestsLoaded(false);
    setTestsExhausted(false);
    loadedTestIdsRef.current = new Set();
    setHistoryView(false);
    testsLoadedRef.current = 0;
    setCalendarView(false);
    setCalendarEntries([]);
    setLastHistoryPage(1);
    setDeletingId(null);

    loadEntries(0, ENTRIES_PAGE_SIZE, false)
      .then(() => {
        if (cancelled) return;
        setEntriesLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Diary fetch error:", e);
        setEntriesLoaded(true);
      });

    loadSummary();

    // 趋势与测肤首屏带 60s 短缓存，重复开关弹层不重复请求
    fetchWithShortCache("/api/user/skin-trends")
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

    fetchWithShortCache(`/api/advisor/history?page=1&limit=${TESTS_PAGE_SIZE}&lite=1`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        const history: HistorySession[] = data.history ?? [];
        setTests(history);
        testsLoadedRef.current = history.length;
        loadedTestIdsRef.current = new Set(history.map((t) => t.sessionId));
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
  }, [isOpen, user, loadEntries, loadSummary]);

  // 日历热力图：切换视图/月份时按需拉取该月条目；打卡保存/删除后随 refreshKey 重拉
  useEffect(() => {
    if (!isOpen || !user || !calendarView) return;
    let cancelled = false;
    setCalendarLoading(true);
    fetch(`/api/user/diary?month=${calendarMonth}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        setCalendarEntries(data.data ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Calendar month fetch error:", e);
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, user, calendarView, calendarMonth, calendarRefreshKey]);

  // 时间线「加载更早」：分页追加测肤记录（sessionId 去重；无新增时置 exhausted 防止重复拉取）
  const loadMoreTests = useCallback(async () => {
    if (testsLoadingMore) return;
    setTestsLoadingMore(true);
    try {
      const page = Math.floor(testsLoadedRef.current / TESTS_PAGE_SIZE) + 1;
      const res = await fetch(`/api/advisor/history?page=${page}&limit=${TESTS_PAGE_SIZE}&lite=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const more: HistorySession[] = data.history ?? [];
      const unique = more.filter((t) => !loadedTestIdsRef.current.has(t.sessionId));
      unique.forEach((t) => loadedTestIdsRef.current.add(t.sessionId));
      setTests((prev) => [...prev, ...unique]);
      testsLoadedRef.current += unique.length;
      setTestsTotal(data.pagination?.total ?? 0);
      if (unique.length === 0) setTestsExhausted(true);
    } catch (e) {
      console.error("Load more tests error:", e);
    } finally {
      setTestsLoadingMore(false);
    }
  }, [testsLoadingMore]);

  // 删除日记条目（含历史日期）；删除后刷新列表/统计/日历
  const handleDeleteEntry = useCallback(async (entry: DiaryEntry) => {
    if (deletingId) return;
    setDeletingId(entry.id);
    try {
      const res = await fetchWithCsrf(`/api/user/diary?date=${entry.date.slice(0, 10)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("记录已删除");
      refreshEntries();
    } catch (e) {
      console.error("Diary delete error:", e);
      toast.error("删除未成功，请稍后再试");
    } finally {
      setDeletingId(null);
    }
  }, [deletingId, refreshEntries, toast]);

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
              {/* 标题栏（视图切换时标题随视图变化） */}
              <div className="flex items-center justify-between shrink-0 px-6 md:px-8 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] sm:pt-6 pb-4 border-b border-brand-charcoal/[0.06]">
                <h2
                  id="diary-modal-title"
                  className="text-xl font-serif font-light text-brand-charcoal tracking-[0.08em]"
                >
                  {historyView ? "测肤记录" : "护肤档案"}
                </h2>
                <button
                  onClick={closeDiaryModal}
                  aria-label="关闭"
                  className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* 内容区（可滚动）：两视图淡出/淡入切换，同一弹层内完成 */}
              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-5 md:px-7 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {historyView ? (
                    <m.div
                      key="history"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          type="button"
                          onClick={() => setHistoryView(false)}
                          aria-label="返回护肤档案"
                          className="w-8 h-8 -ml-1 flex items-center justify-center rounded-full text-brand-charcoal/50 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.05] transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                        </button>
                        <span className="text-[12px] text-brand-charcoal/50 font-light tracking-[0.05em]">
                          全部记录
                        </span>
                      </div>
                      <TestHistoryList
                        pageSize={TESTS_PAGE_SIZE}
                        initialPage={lastHistoryPage}
                        initialSessions={lastHistoryPage <= 1 ? tests.slice(0, TESTS_PAGE_SIZE) : undefined}
                        initialTotal={testsTotal}
                        onPageChange={setLastHistoryPage}
                      />
                    </m.div>
                  ) : (
                    <m.div
                      key="main"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
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
                        { icon: TrendingUp, label: "肌肤变化" },
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
                    {/* 肌肤变化（标题与护肤历程同构：区标题在卡片外，等距） */}
                    <section className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[15px] font-semibold flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-brand-charcoal/60" strokeWidth={1.5} />
                          肌肤变化
                        </h3>
                        <span className="flex items-center gap-3">
                          {trends && (
                            <span className="text-[11px] text-brand-charcoal/45 font-light tracking-[0.1em]">
                              近 {trends.scores.length} 次
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setHistoryView(true)}
                            className="text-[12px] text-brand-charcoal/60 font-light tracking-[0.05em] hover:text-brand-charcoal transition-colors cursor-pointer"
                          >
                            全部记录 →
                          </button>
                        </span>
                      </div>

                      {/* 趋势区扁平化：与护肤历程一致，不加外层卡片（图表直接平铺） */}
                      {!trendsLoaded || !entriesLoaded ? (
                        <div className="h-32 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-brand-charcoal/30 animate-spin" />
                        </div>
                      ) : trends ? (
                        <TrendChart trends={trends} />
                      ) : (
                        /* 解锁引导：与护肤历程空态/打卡引导同款虚线框，样式统一 */
                        <div className="rounded-2xl border border-dashed border-brand-charcoal/20 px-4 py-5 text-center">
                          <p className="text-[13px] text-brand-charcoal/55 font-light mb-1.5">
                            完成 2 次测肤后解锁肌肤变化
                          </p>
                          <p className="text-[13px] text-brand-charcoal/50 font-light mb-4">
                            定期测肤，看见肌肤的真实变化
                          </p>
                          <Link
                            href="/questions"
                            className="inline-flex items-center justify-center px-4 h-8 rounded-full border border-brand-charcoal/20 text-brand-charcoal/70 text-[12px] font-light tracking-[0.05em] transition-colors hover:border-brand-charcoal/50 hover:text-brand-charcoal"
                          >
                            去测肤 →
                          </Link>
                        </div>
                      )}
                    </section>

                    {/* 护肤历程 */}
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[15px] font-semibold flex items-center gap-2">
                          <NotebookPen className="w-4 h-4 text-brand-charcoal/60" strokeWidth={1.5} />
                          护肤历程
                        </h3>
                        {/* 视图切换：时间线 / 日历热力图 */}
                        <div className="flex items-center rounded-full border border-brand-charcoal/[0.12] p-0.5">
                          {([
                            { key: false, label: "时间线" },
                            { key: true, label: "日历" },
                          ] as const).map((v) => (
                            <button
                              key={v.label}
                              type="button"
                              onClick={() => setCalendarView(v.key)}
                              aria-pressed={calendarView === v.key}
                              className={`px-3 h-7 rounded-full text-[12px] font-light tracking-[0.05em] transition-colors cursor-pointer ${
                                calendarView === v.key
                                  ? "bg-brand-charcoal text-white"
                                  : "text-brand-charcoal/50 hover:text-brand-charcoal"
                              }`}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 里程碑统计：连续/累计打卡 + 测肤次数 */}
                      {summary && (summary.totalCheckins > 0 || summary.testCount > 0) && (
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-brand-charcoal/[0.08] text-[12px] text-brand-charcoal/70 font-light">
                            <Flame className="w-3.5 h-3.5 text-[#D9730D]" strokeWidth={1.8} />
                            连续打卡 {summary.currentStreak} 天
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-brand-charcoal/[0.08] text-[12px] text-brand-charcoal/70 font-light">
                            <CalendarCheck className="w-3.5 h-3.5 text-brand-charcoal/50" strokeWidth={1.8} />
                            累计打卡 {summary.totalCheckins} 天
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-brand-charcoal/[0.08] text-[12px] text-brand-charcoal/70 font-light">
                            <ScanFace className="w-3.5 h-3.5 text-brand-charcoal/50" strokeWidth={1.8} />
                            已测肤 {summary.testCount} 次
                          </span>
                          {summary.longestStreak > 0 && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] text-brand-charcoal/40 font-light">
                              最长连续 {summary.longestStreak} 天
                            </span>
                          )}
                        </div>
                      )}

                      {calendarView ? (
                        <DiaryCalendar
                          entries={calendarEntries}
                          month={calendarMonth}
                          onMonthChange={setCalendarMonth}
                          onBackfill={(dateStr) => setCheckIn({ open: true, existing: null, dateStr })}
                          loading={calendarLoading}
                        />
                      ) : (
                        <DiaryTimeline
                          entries={entries}
                          tests={tests}
                          loading={!entriesLoaded || !testsLoaded}
                          onCheckIn={(existing, dateStr) => setCheckIn({ open: true, existing, dateStr })}
                          onDeleteEntry={handleDeleteEntry}
                          deletingId={deletingId}
                          hasMoreTests={!testsExhausted && tests.length < testsTotal}
                          testsLoadingMore={testsLoadingMore}
                          onLoadMoreTests={loadMoreTests}
                          hasMoreEntries={entries.length < entriesTotal}
                          entriesLoadingMore={entriesLoadingMore}
                          onLoadMoreEntries={loadMoreEntries}
                          refreshKey={diaryRefreshKey}
                        />
                      )}
                    </section>
                  </div>
                )}
                  </m.div>
                )}
                </AnimatePresence>
              </div>
            </m.div>

            {/* 二级弹层：打卡/补打卡（sheet 叠 sheet，DOM 在后自然置顶）；全部记录已改为同弹层内视图切换 */}
            <CheckInModal
              isOpen={checkIn.open && !!user}
              existing={checkIn.existing}
              dateStr={checkIn.dateStr ?? undefined}
              onClose={() => setCheckIn((s) => ({ ...s, open: false }))}
              onSaved={refreshEntries}
            />
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
