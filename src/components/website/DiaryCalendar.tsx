"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STATE_META, type DiaryEntry } from "@/components/website/DiaryTimeline";
import { isDiaryDateInRange, parseClientDate } from "@/lib/diary-utils";
import { localDateStr } from "@/lib/local-date";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

interface DiaryCalendarProps {
  entries: DiaryEntry[];
  /** 当前展示月份 YYYY-MM */
  month: string;
  onMonthChange: (month: string) => void;
  /** 点击窗口内、无记录的过去日期 → 补打卡（今天/未来日期由调用方处理） */
  onBackfill: (dateStr: string) => void;
  loading?: boolean;
}

/**
 * DiaryCalendar — 护肤历程日历热力图（GitHub 贡献图风格）
 * 每日格子按当日肌肤状态着色，无记录为灰；今天描边；窗口内空日期可点击补打卡。
 */
export function DiaryCalendar({ entries, month, onMonthChange, onBackfill, loading }: DiaryCalendarProps) {
  const todayStr = localDateStr(new Date());

  const entryByDay = useMemo(() => {
    const map = new Map<string, DiaryEntry>();
    for (const e of entries) map.set(e.date.slice(0, 10), e);
    return map;
  }, [entries]);

  const [y, m] = month.split("-").map(Number);
  const firstDay = new Date(`${month}-01T00:00:00.000Z`);
  const leadBlanks = (firstDay.getUTCDay() + 6) % 7; // 周一开头
  const daysInMonth = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 0)).getUTCDate();

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    onMonthChange(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const canBackfill = (dateStr: string) =>
    dateStr < todayStr && isDiaryDateInRange(parseClientDate(dateStr)!, new Date());

  return (
    <div className="rounded-2xl bg-white border border-brand-charcoal/[0.06] px-4 py-4">
      {/* 月份导航 */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="上个月"
          className="w-8 h-8 flex items-center justify-center rounded-full text-brand-charcoal/50 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.05] transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={2} />
        </button>
        <span className="text-[14px] font-medium text-brand-charcoal tracking-[0.08em]">
          {y} 年 {m} 月
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="下个月"
          className="w-8 h-8 flex items-center justify-center rounded-full text-brand-charcoal/50 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.05] transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {/* 星期表头 */}
      <div className="grid grid-cols-7 mb-1.5">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center text-[11px] text-brand-charcoal/40 font-light">
            {w}
          </span>
        ))}
      </div>

      {/* 日期格 */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadBlanks }).map((_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dateStr = `${month}-${String(i + 1).padStart(2, "0")}`;
          const entry = entryByDay.get(dateStr);
          const meta = entry ? STATE_META[entry.skinState] ?? STATE_META.normal : null;
          const isToday = dateStr === todayStr;
          const clickable = !entry && canBackfill(dateStr);

          const cell = (
            <div
              className={`relative aspect-square rounded-lg flex items-center justify-center text-[12px] font-light transition-colors ${
                isToday ? "ring-1 ring-brand-charcoal/60" : ""
              } ${entry ? "" : clickable ? "bg-brand-charcoal/[0.03] text-brand-charcoal/35 hover:bg-brand-charcoal/[0.08] hover:text-brand-charcoal/70" : "bg-brand-charcoal/[0.02] text-brand-charcoal/25"}`}
              style={entry && meta ? { backgroundColor: `${meta.color}1F`, color: meta.color } : undefined}
              title={
                entry
                  ? `${entry.note || meta?.label || ""}`
                  : clickable
                    ? `${dateStr} 补打卡`
                    : undefined
              }
            >
              {i + 1}
            </div>
          );

          return clickable ? (
            <button key={dateStr} type="button" onClick={() => onBackfill(dateStr)} className="cursor-pointer block">
              {cell}
            </button>
          ) : (
            <span key={dateStr}>{cell}</span>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-end gap-3 mt-3">
        {(["great", "good", "normal", "bad", "terrible"] as const).map((key) => (
          <span key={key} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATE_META[key].color }} />
            <span className="text-[10px] text-brand-charcoal/40 font-light">{STATE_META[key].label}</span>
          </span>
        ))}
        {loading && <span className="text-[10px] text-brand-charcoal/35">加载中…</span>}
      </div>
    </div>
  );
}
