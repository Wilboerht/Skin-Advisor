"use client";

export interface TrendsData {
  dates: string[];
  scores: number[];
}

/** 测肤趋势图（纯 SVG，无图表库依赖）：平滑曲线 + 渐变面积 + 网格刻度 + 最新评分摘要 */
export function TrendChart({ trends }: { trends: TrendsData }) {
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
  const latestDate = new Date(trends.dates[n - 1]).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });

  const fmtDay = (d: string) =>
    new Date(d).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

  return (
    <div>
      {/* 摘要：最新评分 + 测评日期 + 与上次差值 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[11px] tracking-[0.15em] text-brand-charcoal/45 font-light mb-1">
            最新综合评分
          </p>
          <p className="text-3xl md:text-4xl font-serif font-light text-brand-charcoal leading-none">
            {latest}
            <span className="text-sm text-brand-charcoal/40 ml-1.5">分</span>
          </p>
          <p className="mt-1.5 text-[11px] text-brand-charcoal/40 font-light tracking-[0.08em]">
            {latestDate} 测
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
              {/* 隐形热区：放大 hover/触摸目标，title 提供日期+分数提示 */}
              <circle cx={p.x} cy={p.y} r={12} fill="transparent">
                <title>{`${fmtDay(p.date)} · ${p.score} 分`}</title>
              </circle>
              {/* 最新点光环：视觉锚点 */}
              {isLatest && (
                <circle cx={p.x} cy={p.y} r={9} fill="none" stroke="#00263E" strokeOpacity="0.2" strokeWidth="1.5" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isLatest ? 4.5 : 3}
                fill={isLatest ? "#00263E" : "#FDFBF7"}
                stroke="#00263E"
                strokeWidth="2"
                className="pointer-events-none"
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
                  {fmtDay(p.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
