"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import {
  CalendarCheck,
  ChevronLeft,
  Flame,
  NotebookPen,
  RefreshCw,
  ScanFace,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useModalBackClose } from "@/hooks/use-modal-back-close";
import type { HistorySession } from "@/components/website/TestHistoryList";
import { TestHistoryList } from "@/components/website/TestHistoryList";
import { DiaryTimeline, STATE_META, type DiaryEntry } from "@/components/website/DiaryTimeline";
import { DiaryCalendar } from "@/components/website/DiaryCalendar";
import { TrendChart, type TrendsData } from "@/components/website/TrendChart";
import { CheckInTrend } from "@/components/website/CheckInTrend";
import { CheckInModal } from "@/components/website/CheckInModal";
import { useDiaryModal } from "@/components/website/DiaryModalContext";
import { AccountModal } from "@/components/website/AccountModal";
import { useToast } from "@/components/ui/Toast";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { localDateStr } from "@/lib/local-date";
import { parseClientDate, isAutoDiaryEntry } from "@/lib/diary-utils";

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
// key 必须带用户标识（scope）：同设备退出再登录另一账号时（SPA 无刷新），
// 仅按 URL 缓存会把上一账号的趋势/测肤记录透给新账号
const SHORT_CACHE_TTL_MS = 60_000;
const shortCache = new Map<string, { ts: number; promise: Promise<unknown> }>();
function fetchWithShortCache(url: string, scope: string): Promise<unknown> {
  const key = `${scope}:${url}`;
  const hit = shortCache.get(key);
  if (hit && Date.now() - hit.ts < SHORT_CACHE_TTL_MS) return hit.promise;
  const promise = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<unknown>;
  });
  promise.catch(() => shortCache.delete(key));
  shortCache.set(key, { ts: Date.now(), promise });
  return promise;
}

// 打卡/删除等数据变更后作废趋势与测肤列表缓存，保证下次打开立即拉取新数据
function bustShortCache(): void {
  for (const key of Array.from(shortCache.keys())) {
    if (key.includes("/api/user/skin-trends") || key.includes("/api/advisor/history")) {
      shortCache.delete(key);
    }
  }
}

/** 时间窗截止时刻（N 天前）。模块级工具：react-hooks/purity 禁止组件作用域内调用 Date.now 等非纯函数 */
function daysAgoCutoff(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
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
  // 短缓存/请求的用户隔离标识：依赖 user?.id 而非 user 引用（定时续期返回同内容新对象不应触发重置）
  const userId = user?.id;
  const toast = useToast();
  const pathname = usePathname();

  // 移动端返回键/返回手势：先关档案弹层（再按返回才离开页面）
  useModalBackClose(isOpen, closeDiaryModal);

  // 路由变化（如点击时间线/测肤记录跳转 /reports/:id、去测肤等）时自动关闭面板：
  // 弹层是 context 状态，客户端导航不会卸载组件，不处理会盖在新页面上
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      if (isOpen) closeDiaryModal();
    }
  }, [pathname, isOpen, closeDiaryModal]);

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  // 日记列表加载失败标记：区分"查询失败"与"真的没有记录"，避免 401/网络抖动显示成空白引导
  const [entriesError, setEntriesError] = useState(false);
  // 服务端是否还有更早的日记条目（来自分页响应的 hasMore；游标分页下 total 口径会变化，不能再用 length < total 判断）
  const [entriesHasMore, setEntriesHasMore] = useState(false);
  const [entriesLoadingMore, setEntriesLoadingMore] = useState(false);
  const [diaryRefreshKey, setDiaryRefreshKey] = useState(0);
  // 游标分页：当前已加载最旧一条的日历日（YYYY-MM-DD），"加载更早"时作为 before 参数
  const entriesCursorRef = useRef<string | null>(null);
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
  // 游标分页：当前已加载最旧一条测肤记录的完成时间（ISO），"加载更早"时作为 before 参数
  const testsCursorRef = useRef<string | null>(null);
  const loadedTestIdsRef = useRef<Set<string>>(new Set());
  // "今天"快照（YYYY-MM-DD）：每次打开弹层时刷新，供时间线/日历/打卡色带统一使用，
  // 避免子组件渲染期调用 new Date()（react-hooks/purity）且跨午夜常驻后口径不刷新
  const [todayStr, setTodayStr] = useState(() => localDateStr(new Date()));
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
    const today = parseClientDate(todayStr);
    if (!today) return 0;
    const cutoffStr = new Date(today.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
    return entries.filter(
      (e) => Boolean(STATE_META[e.skinState]) && e.date.slice(0, 10) >= cutoffStr
    ).length;
  }, [entries, todayStr]);

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

  // 聚合首屏响应落库：条目 + 分页信息 + 里程碑统计（含游标复位）
  const applyBootstrap = useCallback((data: {
    data?: DiaryEntry[];
    pagination?: { total?: number; hasMore?: boolean };
    summary?: DiarySummary | null;
  }) => {
    const list = data.data ?? [];
    setEntries(list);
    setEntriesHasMore(data.pagination?.hasMore ?? false);
    entriesCursorRef.current = list.length > 0 ? list[list.length - 1].date.slice(0, 10) : null;
    setSummary(data.summary ?? null);
  }, []);

  // 聚合首屏直传（不走缓存）：打卡/删除/重试等需要立即回源的路径
  const fetchBootstrap = useCallback(async (limit: number) => {
    const res = await fetch(`/api/user/diary?bootstrap=1&limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  // 测肤记录首屏加载：带 60s 短缓存（重复开关弹层不重复请求）；
  // 失败置 testsError（区别于"无记录"），重试时先作废缓存强制回源
  const loadTests = useCallback(async (bustCache = false) => {
    if (bustCache) bustShortCache();
    setTestsError(false);
    try {
      const data = (await fetchWithShortCache(`/api/advisor/history?page=1&limit=${TESTS_PAGE_SIZE}&lite=1`, userId ?? "anon")) as {
        history?: HistorySession[];
        pagination?: { total?: number };
      };
      const history: HistorySession[] = data.history ?? [];
      setTests(history);
      testsCursorRef.current = history.length > 0 ? history[history.length - 1].completedAt : null;
      loadedTestIdsRef.current = new Set(history.map((t) => t.sessionId));
      setTestsTotal(data.pagination?.total ?? 0);
    } catch (e) {
      console.error("Test history fetch error:", e);
      setTestsError(true);
    } finally {
      setTestsLoaded(true);
    }
  }, [userId]);

  // 打卡保存/删除后刷新：聚合首屏直传回源（条目 + 里程碑统计一次返回），
  // 带回已加载过的条目数量（不多拉一页）+ 折叠回"近 30 天"（refreshKey 自增触发时间线收起）
  const refreshEntries = useCallback(() => {
    const limit = Math.max(ENTRIES_PAGE_SIZE, entries.length);
    fetchBootstrap(limit)
      .then((data) => {
        applyBootstrap(data);
        setEntriesLoaded(true);
        setDiaryRefreshKey((k) => k + 1);
      })
      .catch((e) => {
        console.error("Diary fetch error:", e);
        setEntriesLoaded(true);
      });
    // 日历视图同步刷新
    setCalendarRefreshKey((k) => k + 1);
    // 数据变更后作废短缓存，保证趋势/测肤列表/聚合首屏下次打开拉取新数据
    bustShortCache();
  }, [entries.length, fetchBootstrap, applyBootstrap]);

  // 时间线"加载更早"：游标分页追加更早的日记（before = 当前最旧一条的日历日），
  // 分页期间新增打卡不会像 offset 分页那样漂移；append 时按 id 去重兜底
  const loadMoreEntries = useCallback(async () => {
    const cursor = entriesCursorRef.current;
    if (entriesLoadingMore || !cursor) return;
    setEntriesLoadingMore(true);
    try {
      const res = await fetch(`/api/user/diary?limit=${ENTRIES_PAGE_SIZE}&before=${cursor}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: DiaryEntry[] = data.data ?? [];
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...list.filter((e) => !seen.has(e.id))];
      });
      setEntriesHasMore(data.pagination?.hasMore ?? false);
      if (list.length > 0) entriesCursorRef.current = list[list.length - 1].date.slice(0, 10);
    } catch (e) {
      console.error("Load more entries error:", e);
      toast.error("加载失败，请稍后再试");
    } finally {
      setEntriesLoadingMore(false);
    }
  }, [entriesLoadingMore, toast]);

  // 日记首屏加载失败后的重试（与测肤列表 testsError 对称处理）
  const retryEntries = useCallback(() => {
    setEntriesError(false);
    setEntriesLoaded(false);
    entriesCursorRef.current = null;
    fetchBootstrap(ENTRIES_PAGE_SIZE)
      .then((data) => {
        applyBootstrap(data);
        setEntriesLoaded(true);
      })
      .catch((e) => {
        console.error("Diary fetch error:", e);
        setEntriesError(true);
        setEntriesLoaded(true);
      });
  }, [fetchBootstrap, applyBootstrap]);

  // 依赖 userId 而非 user 引用：定时续期（/api/auth/me）返回内容相同的新对象时，
  // 不应触发本 effect 重置面板数据造成"刷新抖动"
  useEffect(() => {
    if (!isOpen || !userId) return;
    let cancelled = false;

    setEntries([]);
    setEntriesLoaded(false);
    setEntriesError(false);
    setEntriesHasMore(false);
    entriesCursorRef.current = null;
    // 每次打开刷新"今天"快照：跨午夜后重开弹层，今日打卡/日历描边等口径保持正确
    setTodayStr(localDateStr(new Date()));
    setSummary(null);
    setTrends(null);
    setTrendsLoaded(false);
    setTests([]);
    setTestsLoaded(false);
    setTestsError(false);
    setTestsExhausted(false);
    loadedTestIdsRef.current = new Set();
    setHistoryView(false);
    testsCursorRef.current = null;
    setCalendarView(false);
    setCalendarEntries([]);
    setLastHistoryPage(1);
    setDeletingId(null);

    // 聚合首屏（条目 + 里程碑统计一次请求）始终直传回源：测肤完成会在服务端自动生成
    // 当日日记条目，若走 60s 短缓存，测肤后立刻重开弹层会看不到刚生成的记录；
    // 请求扇出已由聚合减半（原来 entries + summary 两次独立请求），无需再靠缓存省流
    fetchBootstrap(ENTRIES_PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        applyBootstrap(data);
        setEntriesLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Diary fetch error:", e);
        // 区分"加载失败"与"无记录"：失败时展示错误条 + 重试，而非空态引导
        setEntriesError(true);
        setEntriesLoaded(true);
      });

    // 趋势首屏带 60s 短缓存，重复开关弹层不重复请求
    fetchWithShortCache("/api/user/skin-trends", userId)
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
  }, [isOpen, userId, fetchBootstrap, applyBootstrap, loadTests]);

  // 日历热力图：切换视图/月份时按需拉取该月条目；打卡保存/删除后随 refreshKey 重拉
  useEffect(() => {
    if (!isOpen || !userId || !calendarView) return;
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
  }, [isOpen, userId, calendarView, calendarMonth, calendarRefreshKey]);

  // 时间线「加载更早」：游标分页追加更早的测肤记录（before = 当前最旧一条的完成时间），
  // 分页期间新增测肤不会像 offset 页码推导那样漂移；sessionId 去重兜底，无新增时置 exhausted
  const loadMoreTests = useCallback(async () => {
    const cursor = testsCursorRef.current;
    if (testsLoadingMore) return;
    // 游标为空说明首屏为空（或数据不一致：total>0 但首页无记录）——无法定位"更早"，直接封底避免死按钮
    if (!cursor) {
      setTestsExhausted(true);
      return;
    }
    setTestsLoadingMore(true);
    try {
      const res = await fetch(`/api/advisor/history?limit=${TESTS_PAGE_SIZE}&lite=1&before=${encodeURIComponent(cursor)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const more: HistorySession[] = data.history ?? [];
      const unique = more.filter((t) => !loadedTestIdsRef.current.has(t.sessionId));
      unique.forEach((t) => loadedTestIdsRef.current.add(t.sessionId));
      setTests((prev) => [...prev, ...unique]);
      if (more.length > 0) testsCursorRef.current = more[more.length - 1].completedAt;
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

  // 未登录：直接复用「我的」账户弹层的未登录视图（同一紧凑壳 + LoginGuide），保持全站一致性
  if (!user) {
    return <AccountModal isOpen={isOpen} onClose={closeDiaryModal} />;
  }

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
              className="relative z-10 w-full max-h-[86dvh] sm:max-h-none sm:h-[min(680px,calc(100dvh-3rem))] sm:max-w-[1100px] bg-[#F7F4EE] rounded-t-[28px] sm:rounded-[2.5rem] shadow-[0_45px_80px_-16px_rgba(61,47,37,0.18)] overflow-hidden flex flex-col"
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
                  className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.04] transition-colors"
                >
                  <X size={17} strokeWidth={1.5} />
                </button>
              </div>

              {/* 内容区（可滚动）：两视图淡出/淡入切换，同一弹层内完成 */}
              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-5 sm:px-6 md:px-8 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
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
                          className="w-8 h-8 -ml-1 flex items-center justify-center rounded-full text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.04] transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <span className="text-[12px] text-brand-charcoal/60 font-light tracking-[0.05em]">
                          返回护肤档案
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
                      className="min-h-full flex flex-col"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                {/* ===== 登录：趋势 + 时间线 ===== */}
                {/* PC 端（lg+）双列：左「肌肤变化」sticky，右「护肤历程」；移动端单列堆叠 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-10">
                    {/* 肌肤变化：标题行承载时间窗切换与全部记录入口 */}
                    <section className="mb-8 lg:mb-0 lg:self-start lg:sticky lg:top-0">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[15px] font-medium text-[var(--color-brand-espresso)] flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[var(--color-brand-taupe)]" strokeWidth={1.5} />
                          肌肤变化
                        </h3>
                        <div className="flex items-center gap-3">
                          {aggregatedTrends && (
                            <div className="inline-flex rounded-full border border-brand-espresso/[0.12] bg-white p-1" role="group" aria-label="趋势时间范围">
                              {([7, 30] as const).map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => switchTrendRange(r)}
                                  aria-pressed={trendRange === r}
                                  className={`inline-flex h-7 items-center rounded-full px-3 text-[12px] transition-colors cursor-pointer ${
                                    trendRange === r
                                      ? "bg-brand-charcoal/[0.08] text-brand-charcoal font-medium"
                                      : "text-brand-charcoal/60 hover:text-brand-charcoal"
                                  }`}
                                >
                                  近 {r} 天
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 趋势区：与时间轴同风格的极简平铺（无卡片外壳，靠留白组织） */}
                      {!trendsLoaded || !entriesLoaded ? (
                        <div className="animate-pulse">
                          {/* 摘要骨架：与 TrendChart 真实布局一致（左：标签+大字+日期，右：差值胶囊），避免加载完成瞬间跳动 */}
                          <div className="flex items-end justify-between mb-4">
                            <div>
                              <div className="h-3 w-24 rounded-full bg-brand-charcoal/[0.06] mb-2.5" />
                              <div className="h-9 w-32 rounded-lg bg-brand-charcoal/[0.08] mb-2.5" />
                              <div className="h-3 w-20 rounded-full bg-brand-charcoal/[0.06]" />
                            </div>
                            <div className="h-6 w-16 rounded-full bg-brand-charcoal/[0.06]" />
                          </div>
                          {/* 图表骨架 */}
                          <div className="h-40 rounded-xl bg-brand-charcoal/[0.04]" />
                        </div>
                      ) : aggregatedTrends ? (
                        <div>
                          {rangeCutoff === null ? (
                            <div className="h-32" />
                          ) : rangeTrends ? (
                            <TrendChart trends={rangeTrends} />
                          ) : (
                            <div className="py-6 text-center">
                              <p className="text-[13px] text-brand-charcoal/60 font-light">
                                近 {trendRange} 天内测肤不足 2 次，暂无趋势可看
                              </p>
                            </div>
                          )}

                          {/* 打卡色带与测肤时间窗无关：有打卡数据即始终展示 */}
                          {recentCheckInCount >= 2 && (
                            <div className="mt-4">
                              <CheckInTrend entries={entries} todayStr={todayStr} />
                            </div>
                          )}
                          {/* 全部记录入口：图表板块收尾，居中 */}
                          <div className="mt-6 flex justify-center">
                            <button
                              type="button"
                              onClick={() => setHistoryView(true)}
                              className="shrink-0 h-9 inline-flex items-center px-4 rounded-full border border-brand-espresso/20 text-brand-charcoal/60 text-[12px] transition-colors hover:border-brand-espresso/50 hover:text-brand-charcoal cursor-pointer"
                            >
                              全部测肤记录 →
                            </button>
                          </div>
                        </div>
                      ) : recentCheckInCount >= 2 ? (
                        <div>
                          <CheckInTrend entries={entries} todayStr={todayStr} />
                          <p className="mt-4 text-[11px] text-brand-charcoal/60 font-light text-center">
                            完成两次不同日期的测肤后，可叠加查看测肤评分趋势
                          </p>
                        </div>
                      ) : (
                        /* 解锁引导：极简居中（无框），CTA 按钮承载行动感 */
                        <div className="py-6 text-center">
                          <p className="text-[13px] text-brand-charcoal/70 font-light leading-[1.8] tracking-[0.06em] mb-2">
                            完成两次不同日期的测肤后解锁肌肤变化
                          </p>
                          <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] mb-4">
                            定期测肤，看见肌肤的真实变化
                          </p>
                          <Link
                            href="/questions"
                            className="inline-flex items-center justify-center px-5 h-9 rounded-full bg-[var(--color-brand-cocoa)] text-white text-[12px] font-medium tracking-[0.05em] transition-colors hover:bg-brand-cocoa-dark"
                          >
                            去测肤 →
                          </Link>
                        </div>
                      )}

                      {/* 里程碑统计：数据概览，与趋势图同属左列；独立于趋势分支（仅有打卡无趋势时仍展示）。
                          列数跟随实际项数（最长连续为 0 时不占列），避免 3 项摊在 4 列里偏左 */}
                      {summary && (summary.totalCheckins > 0 || summary.testCount > 0) && (
                        <div className={`grid ${summary.longestStreak > 0 ? "grid-cols-4" : "grid-cols-3"} mt-6 pt-4 border-t border-brand-espresso/[0.06]`}>
                          <div className="flex flex-col items-center gap-1.5 py-1 border-r border-brand-espresso/[0.06] last:border-r-0">
                            <p className="text-xl font-serif font-light text-brand-charcoal leading-none">
                              {summary.currentStreak}
                              <span className="ml-0.5 text-[11px] font-sans font-light text-brand-charcoal/65">天</span>
                            </p>
                            <p className="flex items-center gap-1 text-[11px] text-brand-charcoal/65 font-light">
                              <Flame className="w-3 h-3 text-brand-ember" strokeWidth={1.8} />
                              连续打卡
                            </p>
                          </div>
                          <div className="flex flex-col items-center gap-1.5 py-1 border-r border-brand-espresso/[0.06] last:border-r-0">
                            <p className="text-xl font-serif font-light text-brand-charcoal leading-none">
                              {summary.totalCheckins}
                              <span className="ml-0.5 text-[11px] font-sans font-light text-brand-charcoal/65">次</span>
                            </p>
                            <p className="flex items-center gap-1 text-[11px] text-brand-charcoal/65 font-light">
                              <CalendarCheck className="w-3 h-3 text-brand-charcoal/65" strokeWidth={1.8} />
                              累计打卡
                            </p>
                          </div>
                          <div className="flex flex-col items-center gap-1.5 py-1 border-r border-brand-espresso/[0.06] last:border-r-0">
                            <p className="text-xl font-serif font-light text-brand-charcoal leading-none">
                              {summary.testCount}
                              <span className="ml-0.5 text-[11px] font-sans font-light text-brand-charcoal/65">次</span>
                            </p>
                            <p className="flex items-center gap-1 text-[11px] text-brand-charcoal/65 font-light">
                              <ScanFace className="w-3 h-3 text-brand-charcoal/65" strokeWidth={1.8} />
                              已测肤
                            </p>
                          </div>
                          {summary.longestStreak > 0 && (
                            <div className="flex flex-col items-center gap-1.5 py-1 border-r border-brand-espresso/[0.06] last:border-r-0">
                              <p className="text-xl font-serif font-light text-brand-charcoal leading-none">
                                {summary.longestStreak}
                                <span className="ml-0.5 text-[11px] font-sans font-light text-brand-charcoal/65">天</span>
                              </p>
                              <p className="flex items-center gap-1 text-[11px] text-brand-charcoal/65 font-light">
                                <Trophy className="w-3 h-3 text-brand-gold" strokeWidth={1.8} />
                                最长连续
                              </p>
                            </div>
                          )}
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
                        {/* 视图切换：胶囊分段（与全站 tabs 规范一致） */}
                        <div className="inline-flex rounded-full border border-brand-espresso/[0.12] bg-white p-1" role="group" aria-label="历程视图切换">
                          {([
                            { key: false, label: "时间线" },
                            { key: true, label: "日历" },
                          ] as const).map((v) => (
                            <button
                              key={v.label}
                              type="button"
                              onClick={() => setCalendarView(v.key)}
                              aria-pressed={calendarView === v.key}
                              className={`inline-flex h-7 items-center rounded-full px-3 text-[12px] transition-colors cursor-pointer ${
                                calendarView === v.key
                                  ? "bg-brand-charcoal/[0.08] text-brand-charcoal font-medium"
                                  : "text-brand-charcoal/60 hover:text-brand-charcoal"
                              }`}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {calendarView ? (
                        <DiaryCalendar
                          entries={calendarEntries}
                          month={calendarMonth}
                          todayStr={todayStr}
                          onMonthChange={setCalendarMonth}
                          onBackfill={(dateStr) => setCheckIn({ open: true, existing: null, dateStr })}
                          onSelectEntry={(entry) => {
                            // 测肤自动条目对用户不算手动打卡：点按走"接管"语义（existing=null 新建覆盖）；
                            // 手动打卡条目带入旧值编辑（与时间线的入口语义一致）
                            setCheckIn({
                              open: true,
                              existing: isAutoDiaryEntry(entry) ? null : entry,
                              dateStr: entry.date.slice(0, 10),
                            });
                          }}
                          loading={calendarLoading}
                        />
                      ) : (
                        <>
                        {testsError && (
                          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-brand-gold/30 bg-brand-gold/[0.06] px-4 py-3">
                            <span className="text-[13px] text-brand-charcoal/70 font-light">
                              测肤记录加载失败，可能是网络波动或登录状态过期
                            </span>
                            <button
                              type="button"
                              onClick={() => loadTests(true)}
                              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-[var(--color-brand-cocoa)] text-white text-[12px] font-medium hover:bg-brand-cocoa-dark transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" strokeWidth={1.8} />
                              重试
                            </button>
                          </div>
                        )}
                        {entriesError ? (
                          <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-gold/30 bg-brand-gold/[0.06] px-4 py-3">
                            <span className="text-[13px] text-brand-charcoal/70 font-light">
                              护肤记录加载失败，可能是网络波动或登录状态过期
                            </span>
                            <button
                              type="button"
                              onClick={retryEntries}
                              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-[var(--color-brand-cocoa)] text-white text-[12px] font-medium hover:bg-brand-cocoa-dark transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" strokeWidth={1.8} />
                              重试
                            </button>
                          </div>
                        ) : (
                        <DiaryTimeline
                          entries={entries}
                          tests={tests}
                          loading={!entriesLoaded || !testsLoaded}
                          todayStr={todayStr}
                          onCheckIn={(existing, dateStr) => setCheckIn({ open: true, existing, dateStr })}
                          onDeleteEntry={handleDeleteEntry}
                          deletingId={deletingId}
                          hasMoreTests={!testsExhausted && tests.length < testsTotal}
                          testsLoadingMore={testsLoadingMore}
                          onLoadMoreTests={loadMoreTests}
                          hasMoreEntries={entriesHasMore}
                          entriesLoadingMore={entriesLoadingMore}
                          onLoadMoreEntries={loadMoreEntries}
                          refreshKey={diaryRefreshKey}
                        />
                        )}
                        </>
                      )}
                    </section>
                </div>
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
