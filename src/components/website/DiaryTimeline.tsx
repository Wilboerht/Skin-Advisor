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
} from "lucide-react";
import type { HistorySession } from "@/components/website/TestHistoryList";

/**
 * DiaryTimeline — 护肤历程时间线（PRD v1.5）
 * 合并两类事件按日分组倒序：日记打卡 + 测肤里程碑；
 * 空日期不渲染，今天置顶，首屏近 30 天 + "加载更早"。
 */

export interface DiaryEntry {
  id: string;
  date: string; // ISO，UTC 零点，表示客户端本地日历日
  skinState: string;
  tags?: string[] | null;
  note?: string | null;
}

/** 客户端本地日历日 → YYYY-MM-DD（"当日"判据，与 PRD 时区方案一致） */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  /** 登录后传入：今日打卡（existing 为 null）或编辑当日记录 */
  onCheckIn?: (existing: DiaryEntry | null) => void;
  /** 服务端还有更早的测肤记录未拉取（分页未拉完） */
  hasMoreTests?: boolean;
  /** 正在分页拉取更早的测肤记录 */
  testsLoadingMore?: boolean;
  /** 请求加载更早的测肤记录（追加到 tests） */
  onLoadMoreTests?: () => void;
}

export function DiaryTimeline({
  entries,
  tests,
  loading,
  onCheckIn,
  hasMoreTests = false,
  testsLoadingMore = false,
  onLoadMoreTests,
}: DiaryTimelineProps) {
  const [showAll, setShowAll] = useState(false);

  // 打卡保存/刷新日记后回到"近 30 天"折叠态（entries 引用变化触发；分页追加 tests 不重置展开态）
  useEffect(() => {
    setShowAll(false);
  }, [entries]);

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
                onClick={() => onCheckIn(null)}
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
                {isToday && !group.events.some((e) => e.kind === "diary") && (
                  group.events.length === 0 ? (
                    <div className="relative">
                      <span className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 border-dashed border-brand-charcoal/30 bg-[#FDFBF7]" />
                      <div className="rounded-2xl border border-dashed border-brand-charcoal/20 px-4 py-3.5 flex items-center gap-3">
                        <span className="flex-1 text-[13px] text-brand-charcoal/55 font-light">
                          今天还没有记录
                        </span>
                        {onCheckIn && (
                          <button
                            type="button"
                            onClick={() => onCheckIn(null)}
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
                          onClick={() => onCheckIn(null)}
                          className="block w-full rounded-2xl border border-dashed border-brand-charcoal/20 px-4 py-3 text-left text-[12px] text-brand-charcoal/55 font-light hover:border-brand-charcoal/40 hover:text-brand-charcoal transition-colors cursor-pointer"
                        >
                          今天还没有打卡，记录一下今日肌肤状态 →
                        </button>
                      </div>
                    )
                  )
                )}

                {group.events.map((ev, i) => {
                  if (ev.kind === "diary") {
                    const meta = STATE_META[ev.entry.skinState] ?? STATE_META.normal;
                    const Icon = meta.icon;
                    return (
                      <div key={`d-${ev.entry.id}-${i}`} className="relative">
                        <span
                          className="absolute -left-[21px] top-4 w-2.5 h-2.5 rounded-full border-2 border-[#FDFBF7]"
                          style={{ backgroundColor: meta.color }}
                        />
                        <div className="rounded-2xl bg-white border border-brand-charcoal/[0.06] px-4 py-3.5 transition-colors hover:border-brand-charcoal/[0.15]">
                          {isToday && onCheckIn && (
                            <button
                              type="button"
                              onClick={() => onCheckIn(ev.entry)}
                              aria-label="编辑今日记录"
                              className="float-right ml-2 -mt-0.5 w-8 h-8 flex items-center justify-center rounded-full text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.06] transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" strokeWidth={1.8} />
                            </button>
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

      {(hiddenCount > 0 || hasMoreTests) && (
        <button
          type="button"
          onClick={() => {
            if (hiddenCount > 0 || hasMoreTests) setShowAll(true);
            onLoadMoreTests?.();
          }}
          disabled={testsLoadingMore}
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-full border border-brand-charcoal/15 text-[12px] text-brand-charcoal/60 font-light tracking-[0.08em] hover:border-brand-charcoal/40 hover:text-brand-charcoal transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          {testsLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {hiddenCount > 0 ? `加载更早的记录（还有 ${hiddenCount} 天）` : "加载更早的记录"}
        </button>
      )}
    </div>
  );
}
