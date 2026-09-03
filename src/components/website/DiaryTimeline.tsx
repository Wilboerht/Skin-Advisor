"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Angry,
  ChevronRight,
  Frown,
  Laugh,
  Loader2,
  Meh,
  Pencil,
  ScanFace,
  Smile,
  Trash2,
} from "lucide-react";
import type { HistorySession } from "@/components/website/TestHistoryList";
import { localDateStr } from "@/lib/local-date";
import { isAutoDiaryEntry, isDiaryDateInRange, parseClientDate } from "@/lib/diary-utils";

/**
 * DiaryTimeline — 护肤历程时间线（PRD v1.5）
 * 合并两类事件按日分组倒序：日记打卡 + 测肤里程碑；
 * 空日期不渲染，今天置顶，首屏近 30 天 + "加载更早"。
 * 同日既有测肤又有其自动生成的日记条目时，隐藏自动日记卡避免重复展示。
 */

export interface DiaryEntry {
  id: string;
  date: string; // ISO，UTC 零点，表示客户端本地日历日
  skinState: string;
  tags?: string[] | null;
  note?: string | null;
}

export const STATE_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }> = {
  great: { label: "很好", color: "#4C8055", icon: Laugh },
  good: { label: "不错", color: "#7A9A5B", icon: Smile },
  normal: { label: "一般", color: "#C9A86C", icon: Meh },
  bad: { label: "较差", color: "#D9730D", icon: Frown },
  terrible: { label: "爆痘敏感", color: "#D44C47", icon: Angry },
};

const RECENT_DAYS = 30;

type TimelineEvent =
  | { kind: "diary"; entry: DiaryEntry }
  | { kind: "test"; test: HistorySession };

interface DayGroup {
  dateStr: string;
  events: TimelineEvent[];
}

interface DiaryTimelineProps {
  entries: DiaryEntry[];
  tests: HistorySession[];
  loading: boolean;
  /** 打开打卡弹层：existing 为 null 新建（dateStr 目标日期），非 null 编辑当日记录 */
  onCheckIn?: (existing: DiaryEntry | null, dateStr: string) => void;
  /** 删除指定日记条目（时间线卡片删除入口） */
  onDeleteEntry?: (entry: DiaryEntry) => void;
  /** 正在删除的条目 id（禁用态/加载提示） */
  deletingId?: string | null;
  /** 服务端还有更早的测肤记录未拉取（分页未拉完） */
  hasMoreTests?: boolean;
  /** 正在分页拉取更早的测肤记录 */
  testsLoadingMore?: boolean;
  /** 请求加载更早的测肤记录（追加到 tests） */
  onLoadMoreTests?: () => void;
  /** 服务端还有更早的日记记录未拉取（分页未拉完） */
  hasMoreEntries?: boolean;
  /** 正在分页拉取更早的日记记录 */
  entriesLoadingMore?: boolean;
  /** 请求加载更早的日记记录（追加到 entries） */
  onLoadMoreEntries?: () => void;
  /** 日记列表刷新（如打卡保存）后自增，用于收起"近 30 天"折叠态 */
  refreshKey?: number;
}

export function DiaryTimeline({
  entries,
  tests,
  loading,
  onCheckIn,
  onDeleteEntry,
  deletingId,
  hasMoreTests = false,
  testsLoadingMore = false,
  onLoadMoreTests,
  hasMoreEntries = false,
  entriesLoadingMore = false,
  onLoadMoreEntries,
  refreshKey,
}: DiaryTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 打卡保存/刷新日记后回到"近 30 天"折叠态；
  // 追加分页（entries 尾部新增）不重置展开态
  useEffect(() => {
    setShowAll(false);
  }, [refreshKey]);

  const todayStr = localDateStr(new Date());

  const groups = useMemo<DayGroup[]>(() => {
    const byDay = new Map<string, TimelineEvent[]>();
    for (const entry of entries) {
      const day = entry.date.slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), { kind: "diary", entry }]);
    }
    for (const test of tests) {
      const day = localDateStr(new Date(test.completedAt));
      byDay.set(day, [...(byDay.get(day) ?? []), { kind: "test", test }]);
    }
    // 今天永远置顶（即使无事件，用于"今天还没记录"引导态）
    if (!byDay.has(todayStr)) byDay.set(todayStr, []);
    return Array.from(byDay.entries())
      .map(([dateStr, events]) => ({ dateStr, events }))
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [entries, tests, todayStr]);

  // 每次渲染按当前本地日计算（跨午夜后"近 30 天"口径自动更新）
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (RECENT_DAYS - 1));
  const cutoffStr = localDateStr(cutoff);

  const visibleGroups = showAll ? groups : groups.filter((g) => g.dateStr >= cutoffStr);
  const hiddenCount = groups.length - visibleGroups.length;
  const hasAnyEvent = entries.length > 0 || tests.length > 0;

  if (loading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-brand-charcoal/30 animate-spin" />
      </div>
    );
  }

  const weekdayOf = (dateStr: string) =>
    new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("zh-CN", { timeZone: "UTC", weekday: "short" });
  const dayOf = (dateStr: string) => String(parseInt(dateStr.slice(8, 10), 10));
  const monthLabelOf = (dateStr: string) =>
    `${dateStr.slice(0, 4)} 年 ${parseInt(dateStr.slice(5, 7), 10)} 月`;
  const canBackfill = (dateStr: string) => {
    const d = parseClientDate(dateStr);
    return !!d && isDiaryDateInRange(d, new Date());
  };

  return (
    <div>
      {!hasAnyEvent && (
        <div className="rounded-3xl border border-dashed border-brand-charcoal/[0.15] py-10 text-center mb-6">
          <p className="text-[13px] text-brand-charcoal/50 font-light mb-4">
            完成一次测肤后，这里会自动生成你的护肤记录
          </p>
          <div className="flex items-center justify-center gap-3">
            {onCheckIn && (
              <button
                type="button"
                onClick={() => onCheckIn(null, todayStr)}
                className="inline-flex items-center justify-center px-5 h-9 rounded-full bg-brand-charcoal text-white text-[12px] tracking-[0.08em] font-light transition-opacity hover:opacity-90 cursor-pointer"
              >
                打卡
              </button>
            )}
            <Link
              href="/questions"
              className="inline-flex items-center justify-center px-5 h-9 rounded-full border border-brand-charcoal/20 text-brand-charcoal/70 text-[12px] tracking-[0.08em] font-light transition-colors hover:border-brand-charcoal/50 hover:text-brand-charcoal"
            >
              去测肤 →
            </Link>
          </div>
        </div>
      )}

      {hasAnyEvent && visibleGroups.map((group, gi) => {
        const isToday = group.dateStr === todayStr;
        const month = group.dateStr.slice(0, 7);
        // 同日既有测肤又有其自动生成的日记条目时，隐藏自动日记卡，避免同一次测肤重复展示
        const visibleEvents = group.events.filter(
          (e) => e.kind === "test" || !isAutoDiaryEntry(e.entry)
        );
        // 当日测肤最高分（用于手动打卡卡片的同日对照提示）
        const dayScores = group.events
          .flatMap((e) => (e.kind === "test" ? [e.test] : []))
          .map((t) => t.analysisResult?.faceAnalysis?.overallScore)
          .filter((s): s is number => typeof s === "number" && s > 0);
        const maxDayScore = dayScores.length > 0 ? Math.max(...dayScores) : null;
        // 跨月时插入月份分隔行（纯函数判定，不依赖渲染期可变状态）
        const monthDivider =
          gi === 0 || visibleGroups[gi - 1].dateStr.slice(0, 7) !== month
            ? monthLabelOf(group.dateStr)
            : null;

        return (
          <div key={group.dateStr}>
            {monthDivider && (
              <div className="flex items-center gap-3 mb-3 mt-2 first:mt-0">
                <span className="shrink-0 text-[11px] tracking-[0.2em] text-brand-charcoal/40">
                  {monthDivider}
                </span>
                <span className="flex-1 h-px bg-brand-charcoal/[0.08]" />
              </div>
            )}
            <div className="flex gap-4 md:gap-5">
              {/* 左轴：星期 + 日号（藏青文字 + 细线，不做深色块） */}
              <div className="w-10 shrink-0 pt-3 text-center">
                <div className="text-[10px] tracking-[0.15em] text-brand-charcoal/45">
                  {isToday ? "今天" : weekdayOf(group.dateStr)}
                </div>
                <div className={`text-xl font-serif leading-tight ${isToday ? "text-brand-charcoal font-medium" : "text-brand-charcoal/80"}`}>
                  {dayOf(group.dateStr)}
                </div>
              </div>

              {/* 右侧事件列：细竖线串联 */}
              <div className="relative flex-1 border-l border-brand-charcoal/10 pl-4 pb-6 space-y-2.5">
                {/* 今日打卡引导：今天没有任何事件时展示完整引导盒；有测肤等事件但无日记时补一条打卡入口 */}
                {isToday && !visibleEvents.some((e) => e.kind === "diary") && (
                  visibleEvents.length === 0 ? (
                    <div className="relative">
                      <span className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 border-dashed border-brand-charcoal/30 bg-[#FDFBF7]" />
                      <div className="rounded-2xl border border-dashed border-brand-charcoal/20 px-4 py-3.5 flex items-center gap-3">
                        <span className="flex-1 text-[13px] text-brand-charcoal/55 font-light">
                          今天还没有记录
                        </span>
                        {onCheckIn && (
                          <button
                            type="button"
                            onClick={() => onCheckIn(null, todayStr)}
                            className="shrink-0 min-h-[32px] px-3.5 rounded-full bg-brand-charcoal text-white text-[12px] font-light tracking-[0.05em] transition-opacity hover:opacity-85 cursor-pointer"
                          >
                            打卡
                          </button>
                        )}
                        <Link
                          href="/questions"
                          className="shrink-0 min-h-[32px] inline-flex items-center px-3.5 rounded-full border border-brand-charcoal/20 text-brand-charcoal/70 text-[12px] font-light tracking-[0.05em] transition-colors hover:border-brand-charcoal/50 hover:text-brand-charcoal"
                        >
                          去测肤 →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    onCheckIn && (
                      <div className="relative">
                        <span className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 border-dashed border-brand-charcoal/30 bg-[#FDFBF7]" />
                        <button
                          type="button"
                          onClick={() => onCheckIn(null, todayStr)}
                          className="block w-full rounded-2xl border border-dashed border-brand-charcoal/20 px-4 py-3 text-left text-[12px] text-brand-charcoal/55 font-light hover:border-brand-charcoal/40 hover:text-brand-charcoal transition-colors cursor-pointer"
                        >
                          今天还没有打卡，记录一下今日肌肤状态 →
                        </button>
                      </div>
                    )
                  )
                )}

                {/* 补打卡：过去的空日期（写入窗口内）提供补录入口，错过不再永久断档 */}
                {!isToday &&
                  !visibleEvents.some((e) => e.kind === "diary") &&
                  onCheckIn &&
                  canBackfill(group.dateStr) && (
                    <div className="relative">
                      <span className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 border-dashed border-brand-charcoal/30 bg-[#FDFBF7]" />
                      <button
                        type="button"
                        onClick={() => onCheckIn(null, group.dateStr)}
                        className="block w-full rounded-2xl border border-dashed border-brand-charcoal/20 px-4 py-3 text-left text-[12px] text-brand-charcoal/45 font-light hover:border-brand-charcoal/40 hover:text-brand-charcoal transition-colors cursor-pointer"
                      >
                        补打卡 →
                      </button>
                    </div>
                  )}

                {visibleEvents.map((ev, i) => {
                  if (ev.kind === "diary") {
                    const meta = STATE_META[ev.entry.skinState] ?? STATE_META.normal;
                    const Icon = meta.icon;
                    const auto = isAutoDiaryEntry(ev.entry);
                    return (
                      <div key={`d-${ev.entry.id}-${i}`} className="relative">
                        <span
                          className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 border-[#FDFBF7]"
                          style={{ backgroundColor: meta.color }}
                        />
                        <div className="rounded-2xl bg-white border border-brand-charcoal/[0.06] px-4 py-3.5 transition-colors hover:border-brand-charcoal/[0.15]">
                          {(onDeleteEntry || (isToday && onCheckIn)) && (
                            <div className="flex justify-end gap-1 -mt-1 mb-1">
                              {isToday && onCheckIn && (
                                <button
                                  type="button"
                                  onClick={() => onCheckIn(ev.entry, todayStr)}
                                  aria-label="编辑今日记录"
                                  className="w-8 h-8 flex items-center justify-center rounded-full text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.06] transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.8} />
                                </button>
                              )}
                              {onDeleteEntry && (confirmDeleteId === ev.entry.id ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={deletingId === ev.entry.id}
                                    onClick={() => onDeleteEntry(ev.entry)}
                                    className="h-8 px-2.5 flex items-center rounded-full bg-[#D44C47]/10 text-[#D44C47] text-[11px] font-light tracking-[0.05em] disabled:opacity-50 cursor-pointer"
                                  >
                                    确认删除
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="h-8 px-2.5 flex items-center rounded-full text-brand-charcoal/50 text-[11px] font-light hover:bg-brand-charcoal/[0.05] cursor-pointer"
                                  >
                                    取消
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(ev.entry.id)}
                                  aria-label="删除记录"
                                  className="w-8 h-8 flex items-center justify-center rounded-full text-brand-charcoal/30 hover:text-[#D44C47] hover:bg-[#D44C47]/[0.06] transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full"
                              style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
                            >
                              <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                              {meta.label}
                            </span>
                            {ev.entry.tags?.map((tag) => (
                              <span
                                key={tag}
                                className="text-[11px] text-brand-charcoal/50 border border-brand-charcoal/[0.1] rounded-full px-2 py-0.5"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          {ev.entry.note && (
                            <p className="mt-2 text-[13px] text-[#5E5E5E] font-light leading-relaxed">
                              {ev.entry.note}
                            </p>
                          )}
                          {/* 同日冲突提示：手动打卡与测肤评分同屏时，补一句客观评分帮助对照 */}
                          {!auto && maxDayScore != null && (
                            <p className="mt-2 text-[11px] text-brand-charcoal/40 font-light">
                              同日测肤 {maxDayScore} 分
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 测肤里程碑
                  const result = ev.test.analysisResult;
                  const score = result?.faceAnalysis?.overallScore;
                  const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
                  return (
                    <div key={`t-${ev.test.sessionId}-${i}`} className="relative">
                      <span className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 border-[#FDFBF7] bg-brand-charcoal" />
                      <Link
                        href={`/reports/${ev.test.sessionId}`}
                        className="group flex items-center gap-3 rounded-2xl bg-brand-charcoal px-4 py-3.5 text-white transition-all duration-300 hover:shadow-[0_8px_24px_rgba(0,38,62,0.25)]"
                      >
                        <ScanFace className="w-4 h-4 shrink-0 text-white/70" strokeWidth={1.5} />
                        <span className="flex-1 min-w-0 text-[13px] font-light truncate">
                          完成测肤{skinType ? ` · ${skinType}` : ""}
                        </span>
                        {score != null && score > 0 && (
                          <span className="text-[13px] font-medium shrink-0">{score} 分</span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/50 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {(hiddenCount > 0 || hasMoreTests || hasMoreEntries) && (
        <button
          type="button"
          onClick={() => {
            if (hiddenCount > 0 || hasMoreTests || hasMoreEntries) setShowAll(true);
            onLoadMoreTests?.();
            onLoadMoreEntries?.();
          }}
          disabled={testsLoadingMore || entriesLoadingMore}
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-full border border-brand-charcoal/15 text-[12px] text-brand-charcoal/60 font-light tracking-[0.08em] hover:border-brand-charcoal/40 hover:text-brand-charcoal transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          {(testsLoadingMore || entriesLoadingMore) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {hiddenCount > 0 ? `加载更早的记录（还有 ${hiddenCount} 天）` : "加载更早的记录"}
        </button>
      )}
    </div>
  );
}
