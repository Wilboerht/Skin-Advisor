"use client";

import { STATE_META, type DiaryEntry } from "@/components/website/DiaryTimeline";
import { localDateStr } from "@/lib/local-date";

const TREND_DAYS = 30;

/** 状态 → 纵坐标档位（1 最差 → 5 最好） */
const STATE_LEVEL: Record<string, number> = {
  terrible: 1,
  bad: 2,
  normal: 3,
  good: 4,
  great: 5,
};

/**
 * CheckInTrend — 近 30 天打卡状态趋势（纯 SVG 色带图）
 * 每日一格按肌肤状态着色，缺卡日显示为浅色空位；
 * 让"肌肤变化"在测肤次数不足时也有每日数据可看。
 */
export function CheckInTrend({ entries }: { entries: DiaryEntry[] }) {
  const dayMap = new Map<string, DiaryEntry>();
  for (const entry of entries) {
    const day = entry.date.slice(0, 10);
    if (STATE_META[entry.skinState] && !dayMap.has(day)) dayMap.set(day, entry);
  }

  const today = new Date();
  const days: { dateStr: string; entry?: DiaryEntry }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = localDateStr(d);
    days.push({ dateStr, entry: dayMap.get(dateStr) });
  }

  const checkedCount = days.filter((d) => d.entry).length;

  const W = 640;
  const H = 72;
  const PAD_L = 4;
  const PAD_R = 4;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 18;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const cellW = plotW / TREND_DAYS;
  const gap = Math.max(1.5, cellW * 0.18);
  const bw = cellW - gap;

  const fmtShort = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", timeZone: "UTC" });
  };

  const firstLabel = fmtShort(days[0].dateStr);
  const lastLabel = fmtShort(days[TREND_DAYS - 1].dateStr);

  return (
    <div>
      <div className="flex items-end justify-between mb-2.5">
        <p className="text-[11px] tracking-[0.15em] text-brand-charcoal/45 font-light">
          近 30 天打卡状态
        </p>
        <p className="text-[11px] text-brand-charcoal/40 font-light">
          已打卡 {checkedCount} 天
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="近 30 天打卡状态趋势">
        {days.map(({ dateStr, entry }, i) => {
          const x = PAD_L + i * cellW;
          const meta = entry ? STATE_META[entry.skinState] : null;
          const level = entry ? STATE_LEVEL[entry.skinState] ?? 3 : 3;
          // 色带高度随状态档位变化（1 档最低 → 5 档最高），缺卡为浅色矮条
          const barH = entry ? (plotH * (1 + level)) / 6 : 4;
          const y = PAD_TOP + plotH - barH;
          return (
            <g key={dateStr}>
              {/* 隐形热区 + 提示 */}
              <rect x={x} y={PAD_TOP} width={cellW} height={plotH} fill="transparent">
                <title>
                  {entry
                    ? `${fmtShort(dateStr)} · ${meta ? meta.label : entry.skinState}`
                    : `${fmtShort(dateStr)} · 未打卡`}
                </title>
              </rect>
              {entry && meta ? (
                <rect
                  x={x + gap / 2}
                  y={y}
                  width={bw}
                  height={barH}
                  rx={Math.min(3, bw / 3)}
                  fill={meta.color}
                  fillOpacity={dateStr === localDateStr(new Date()) ? 1 : 0.75}
                />
              ) : (
                <rect
                  x={x + gap / 2}
                  y={PAD_TOP + plotH - 4}
                  width={bw}
                  height={4}
                  rx={2}
                  fill="#5c4937"
                  fillOpacity={0.07}
                />
              )}
            </g>
          );
        })}

        <text x={PAD_L} y={H - 4} fontSize="9.5" fill="#8c7a6b">
          {firstLabel}
        </text>
        <text x={W - PAD_R} y={H - 4} textAnchor="end" fontSize="9.5" fill="#8c7a6b">
          {lastLabel}
        </text>
      </svg>

      {/* 图例：5 色点 + 两端语义词（中间档位由颜色深浅自然表达），未打卡以灰点示意 */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        <span className="text-[10px] text-brand-charcoal/40 font-light mr-0.5">很好</span>
        {(["great", "good", "normal", "bad", "terrible"] as const).map((key) => (
          <span
            key={key}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: STATE_META[key].color }}
          />
        ))}
        <span className="text-[10px] text-brand-charcoal/40 font-light ml-0.5">很差</span>
        <span className="w-px h-3 bg-brand-espresso/[0.1] mx-1.5" />
        <span className="w-2 h-2 rounded-full bg-brand-charcoal/10" />
        <span className="text-[10px] text-brand-charcoal/40 font-light">未打卡</span>
      </div>
    </div>
  );
}

export default CheckInTrend;
