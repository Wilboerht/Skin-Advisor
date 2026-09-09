"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import {
  CalendarCheck,
  ChevronLeft,
  Flame,
  Loader2,
  NotebookPen,
  RefreshCw,
  ScanFace,
  Smile,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import type { HistorySession } from "@/components/website/TestHistoryList";
import { TestHistoryList } from "@/components/website/TestHistoryList";
import { DiaryTimeline, STATE_META, type DiaryEntry } from "@/components/website/DiaryTimeline";
import { DiaryCalendar } from "@/components/website/DiaryCalendar";
import { TrendChart, type TrendsData } from "@/components/website/TrendChart";
import { CheckInTrend } from "@/components/website/CheckInTrend";
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
// 注意缓存解析后的 JSON 而非 Response——Response body 只能消费一次，缓存 Response 会导致二次读取抛 "body stream already read"
const SHORT_CACHE_TTL_MS = 60_000;
const shortCache = new Map<string, { ts: number; promise: Promise<unknown> }>();
function fetchWithShortCache(url: string): Promise<unknown> {
  const hit = shortCache.get(url);
  if (hit && Date.now() - hit.ts < SHORT_CACHE_TTL_MS) return hit.promise;
  const promise = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<unknown>;
  });
  promise.catch(() => shortCache.delete(url));
  shortCache.set(url, { ts: Date.now(), promise });
  return promise;
}

// 打卡/删除等数据变更后作废趋势与测肤列表缓存，保证下次打开立即拉取新数据
function bustShortCache(): void {
  for (const key of Array.from(shortCache.keys())) {
    if (key.startsWith("/api/user/skin-trends") || key.startsWith("/api/advisor/history")) {
      shortCache.delete(key);
    }
  }
}

/** 时间窗截止时刻（N 天前）。模块级工具：react-hooks/purity 禁止组件作用域内调用 Date.now 等非纯函数 */
function daysAgoCutoff(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

/** 游客视图的装饰性示意曲线（无数值，不代表真实数据） */
function GuestTrendCurve() {
  return (
    <svg viewBox="0 0 200 70" className="w-full h-auto" aria-hidden="true">
      {[18, 36, 54].map((y) => (
        <line key={y} x1="12" y1={y} x2="188" y2={y} stroke="#5c4937" strokeOpacity="0.08" strokeDasharray="2 4" />
      ))}
      <path
        d="M12,56 C42,54 56,36 80,38 S132,54 150,30 S178,20 188,18"
        fill="none"
        stroke="#5c4937"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="5 6"
        strokeLinecap="round"
      />
      <path
        d="M12,62 C48,60 66,48 94,50 S146,58 172,40"
        fill="none"
        stroke="#5c4937"
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
  // 测肤列表加载失败标记：区分"查询失败"与"真的没有记录"，避免 401/网络抖动显示成空白态
  const [testsError, setTestsError] = useState(false);
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

  // 近 30 天内有效打卡天数（与 CheckInTrend 的 30 天窗口口径一致，避免旧数据触发空图）
  const recentCheckInCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    const cutoffStr = localDateStr(cutoff);
    return entries.filter(
      (e) => Boolean(STATE_META[e.skinState]) && e.date.slice(0, 10) >= cutoffStr
    ).length;
  }, [entries]);

  // 趋势按天聚合（本地日历日，同日多次测肤取当日最后一次）：
  // 图看趋势、时间线看明细——单日多次对长期趋势是噪声，且避免 X 轴出现重复日期/等距失真
  const aggregatedTrends = useMemo<TrendsData | null>(() => {
    if (!trends || !Array.isArray(trends.dates) || !Array.isArray(trends.scores)) return null;
    const byDay = new Map<string, { date: string; score: number }>();
    for (let i = 0; i < trends.dates.length; i++) {
      const day = localDateStr(new Date(trends.dates[i]));
      byDay.set(day, { date: trends.dates[i], score: trends.scores[i] });
    }
    const days = Array.from(byDay.values()).slice(-30); // 保留最近 30 天，供时间窗切换
    // 聚合后不足两个"天"无法构成趋势（如当天连测两次）→ 视为无趋势，走解锁引导
    if (days.length < 2) return null;
    return { dates: days.map((d) => d.date), scores: days.map((d) => d.score) };
  }, [trends]);

  // 图表时间窗：近 7 天 / 近 30 天（默认 30 天，可切近 7 天聚焦近期）
  const [trendRange, setTrendRange] = useState<7 | 30>(30);
  // 时间窗截止时刻：渲染期禁止调用 Date.now 等非纯函数（react-hooks/purity），
  // 由切换事件与挂载 effect 维护；null = 尚未初始化（渲染占位）
  const [rangeCutoff, setRangeCutoff] = useState<number | null>(null);
  useEffect(() => {
    if (rangeCutoff === null) setRangeCutoff(daysAgoCutoff(trendRange));
  }, [rangeCutoff, trendRange]);
  const switchTrendRange = (r: 7 | 30) => {
    setTrendRange(r);
    setRangeCutoff(daysAgoCutoff(r));
  };

  // 按时间窗过滤后的趋势数据；窗口内测肤日不足 2 天 → null（该窗口无趋势可看）
  const rangeTrends = useMemo<TrendsData | null>(() => {
    if (!aggregatedTrends || rangeCutoff === null) return null;
    const idx = aggregatedTrends.dates.findIndex((d) => new Date(d).getTime() >= rangeCutoff);
    if (idx === -1) return null;
    const dates = aggregatedTrends.dates.slice(idx);
    const scores = aggregatedTrends.scores.slice(idx);
    return dates.length >= 2 ? { dates, scores } : null;
  }, [aggregatedTrends, rangeCutoff]);

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

  // 测肤记录首屏加载：带 60s 短缓存（重复开关弹层不重复请求）；
  // 失败置 testsError（区别于"无记录"），重试时先作废缓存强制回源
  const loadTests = useCallback(async (bustCache = false) => {
    if (bustCache) bustShortCache();
    setTestsError(false);
    try {
      const data = (await fetchWithShortCache(`/api/advisor/history?page=1&limit=${TESTS_PAGE_SIZE}&lite=1`)) as {
        history?: HistorySession[];
        pagination?: { total?: number };
      };
      const history: HistorySession[] = data.history ?? [];
      setTests(history);
      testsLoadedRef.current = history.length;
      loadedTestIdsRef.current = new Set(history.map((t) => t.sessionId));
      setTestsTotal(data.pagination?.total ?? 0);
    } catch (e) {
      console.error("Test history fetch error:", e);
      setTestsError(true);
    } finally {
      setTestsLoaded(true);
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
    // 数据变更后作废短缓存，保证趋势与测肤列表下次打开拉取新数据
    bustShortCache();
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
    setTestsError(false);
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
      .then((raw) => {
        if (cancelled) return;
        const data = raw as { data?: TrendsData | null };
        setTrends(data.data ?? null); // 测肤 < 2 次时后端返回 data: null
        setTrendsLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Trends fetch error:", e);
        setTrendsLoaded(true);
      });

    loadTests();

    return () => {
      cancelled = true;
    };
  }, [isOpen, user, loadEntries, loadSummary, loadTests]);

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
              className="relative z-10 w-full sm:max-w-2xl max-h-[86dvh] bg-[#F7F4EE] rounded-t-[28px] sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(61,47,37,0.18)] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 标题栏（视图切换时标题随视图变化） */}
              <div className="flex items-center justify-between shrink-0 px-5 sm:px-6 md:px-8 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] sm:pt-6 pb-4 border-b border-brand-espresso/[0.08] bg-[#F7F4EE]/95">
                <h2
                  id="diary-modal-title"
                  className="text-xl font-serif font-light text-brand-charcoal tracking-[0.08em]"
                >
                  {historyView ? "测肤记录" : "护肤档案"}
                </h2>
                <button
                  onClick={closeDiaryModal}
                  aria-label="关闭"
                  className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-brand-charcoal/35 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.04] transition-colors"
                >
                  <X size={17} strokeWidth={1.5} />
                </button>
              </div>

              {/* 内容区（可滚动）：两视图淡出/淡入切换，同一弹层内完成 */}
              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain custom-scrollbar px-4 sm:px-6 md:px-8 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
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
                          className="w-8 h-8 -ml-1 flex items-center justify-center rounded-full text-brand-charcoal/35 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.04] transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <span className="text-[12px] text-brand-charcoal/60 font-light tracking-[0.05em]">
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
                    <div className="max-w-[220px] sm:max-w-[300px] w-full mb-4">
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 border border-brand-espresso/[0.1] text-[12px] text-brand-charcoal/60 font-light tracking-[0.04em] shadow-[0_1px_2px_rgba(61,47,37,0.04)]"
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
                    {/* 肌肤变化：标题行承载时间窗切换与全部记录入口 */}
                    <section className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[15px] font-medium text-[var(--color-brand-espresso)] flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[var(--color-brand-taupe)]" strokeWidth={1.5} />
                          肌肤变化
                        </h3>
                        <div className="flex items-center gap-3">
                          {aggregatedTrends && (
                            <div className="flex items-center">
                              {([7, 30] as const).map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => switchTrendRange(r)}
                                  aria-pressed={trendRange === r}
                                  className={`relative px-2 h-8 text-[12px] transition-colors cursor-pointer ${
                                    trendRange === r
                                      ? "text-brand-charcoal font-medium"
                                      : "text-brand-charcoal/45 hover:text-brand-charcoal"
                                  }`}
                                >
                                  近 {r} 天
                                  {trendRange === r && (
                                    <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 h-[2px] w-4 rounded-full bg-[var(--color-brand-cocoa)]" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                          {aggregatedTrends && (
                            <button
                              type="button"
                              onClick={() => setHistoryView(true)}
                              className="text-[12px] text-brand-charcoal/60 font-light tracking-[0.05em] hover:text-brand-charcoal transition-colors cursor-pointer rounded-full px-2.5 py-1 hover:bg-brand-charcoal/[0.04]"
                            >
                              全部记录 →
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 趋势区：与时间轴同风格的极简平铺（无卡片外壳，靠留白组织） */}
                      {!trendsLoaded || !entriesLoaded ? (
                        <div className="h-32 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-brand-charcoal/30 animate-spin" />
                        </div>
                      ) : aggregatedTrends ? (
                        <div>
                          {rangeCutoff === null ? (
                            <div className="h-32" />
                          ) : rangeTrends ? (
                            <TrendChart trends={rangeTrends} />
                          ) : (
                            <div className="py-6 text-center">
                              <p className="text-[13px] text-brand-charcoal/45 font-light">
                                近 {trendRange} 天内测肤不足 2 次，暂无趋势可看
                              </p>
                            </div>
                          )}
                          {/* 打卡色带与测肤时间窗无关：有打卡数据即始终展示 */}
                          {recentCheckInCount >= 2 && (
                            <div className="mt-7 pt-5 border-t border-brand-espresso/[0.06]">
                              <CheckInTrend entries={entries} />
                            </div>
                          )}
                        </div>
                      ) : recentCheckInCount >= 2 ? (
                        <div>
                          <CheckInTrend entries={entries} />
                          <p className="mt-3 text-[11px] text-brand-charcoal/35 font-light text-center">
                            完成两次不同日期的测肤后，可叠加查看测肤评分趋势
                          </p>
                        </div>
                      ) : (
                        /* 解锁引导：极简居中（无框），CTA 按钮承载行动感 */
                        <div className="py-6 text-center">
                          <p className="text-[13px] text-brand-charcoal/55 font-light mb-1.5">
                            完成两次不同日期的测肤后解锁肌肤变化
                          </p>
                          <p className="text-[13px] text-brand-charcoal/45 font-light mb-4">
                            定期测肤，看见肌肤的真实变化
                          </p>
                          <Link
                            href="/questions"
                            className="inline-flex items-center justify-center px-5 h-9 rounded-full bg-[var(--color-brand-cocoa)] text-white text-[12px] font-medium tracking-[0.05em] transition-colors hover:bg-[#4a3a2c]"
                          >
                            去测肤 →
                          </Link>
                        </div>
                      )}
                    </section>

                    {/* 护肤历程 */}
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[15px] font-medium text-[var(--color-brand-espresso)] flex items-center gap-2">
                          <NotebookPen className="w-4 h-4 text-[var(--color-brand-taupe)]" strokeWidth={1.5} />
                          护肤历程
                        </h3>
                        {/* 视图切换：极简文字 tab，选中深色 + 底部短横线 */}
                        <div className="flex items-center">
                          {([
                            { key: false, label: "时间线" },
                            { key: true, label: "日历" },
                          ] as const).map((v) => (
                            <button
                              key={v.label}
                              type="button"
                              onClick={() => setCalendarView(v.key)}
                              aria-pressed={calendarView === v.key}
                              className={`relative px-2.5 h-8 text-[12px] transition-colors cursor-pointer ${
                                calendarView === v.key
                                  ? "text-brand-charcoal font-medium"
                                  : "text-brand-charcoal/45 hover:text-brand-charcoal"
                              }`}
                            >
                              {v.label}
                              {calendarView === v.key && (
                                <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 h-[2px] w-4 rounded-full bg-[var(--color-brand-cocoa)]" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 里程碑统计：一行四格纯数字（无边框底色），视觉最轻 */}
                      {summary && (summary.totalCheckins > 0 || summary.testCount > 0) && (
                        <div className="grid grid-cols-4 mb-5">
                          <div className="flex flex-col items-center gap-1 py-1 border-r border-brand-espresso/[0.06] last:border-r-0">
                            <p className="text-[17px] font-semibold text-brand-charcoal leading-none">
                              {summary.currentStreak}
                            </p>
                            <p className="flex items-center gap-1 text-[10px] text-brand-charcoal/50 font-light">
                              <Flame className="w-3 h-3 text-[#D9730D]" strokeWidth={1.8} />
                              连续打卡
                            </p>
                          </div>
                          <div className="flex flex-col items-center gap-1 py-1 border-r border-brand-espresso/[0.06] last:border-r-0">
                            <p className="text-[17px] font-semibold text-brand-charcoal leading-none">
                              {summary.totalCheckins}
                            </p>
                            <p className="flex items-center gap-1 text-[10px] text-brand-charcoal/50 font-light">
                              <CalendarCheck className="w-3 h-3 text-brand-charcoal/50" strokeWidth={1.8} />
                              累计打卡
                            </p>
                          </div>
                          <div className="flex flex-col items-center gap-1 py-1 border-r border-brand-espresso/[0.06] last:border-r-0">
                            <p className="text-[17px] font-semibold text-brand-charcoal leading-none">
                              {summary.testCount}
                            </p>
                            <p className="flex items-center gap-1 text-[10px] text-brand-charcoal/50 font-light">
                              <ScanFace className="w-3 h-3 text-brand-charcoal/50" strokeWidth={1.8} />
                              已测肤
                            </p>
                          </div>
                          {summary.longestStreak > 0 && (
                            <div className="flex flex-col items-center gap-1 py-1 border-r border-brand-espresso/[0.06] last:border-r-0">
                              <p className="text-[17px] font-semibold text-brand-charcoal leading-none">
                                {summary.longestStreak}
                              </p>
                              <p className="flex items-center gap-1 text-[10px] text-brand-charcoal/50 font-light">
                                <Trophy className="w-3 h-3 text-[#C9A86C]" strokeWidth={1.8} />
                                最长连续
                              </p>
                            </div>
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
                        <>
                        {testsError && (
                          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#C9A86C]/30 bg-[#C9A86C]/[0.06] px-4 py-3">
                            <span className="text-[13px] text-brand-charcoal/70 font-light">
                              测肤记录加载失败，可能是网络波动或登录状态过期
                            </span>
                            <button
                              type="button"
                              onClick={() => loadTests(true)}
                              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-brand-cocoa)] text-white text-[12px] font-light hover:bg-[#4a3a2c] transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" strokeWidth={1.8} />
                              重试
                            </button>
                          </div>
                        )}
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
                        </>
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
