"use client";

import { useMemo, useState, useEffect } from "react";
import { useMounted } from "@/hooks/use-mounted";
import {
    Bar,
    BarChart,
    Cell,
    LabelList,
    ReferenceLine,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from "recharts";
import type { LabelProps } from "recharts";
import type { SkinDimensions, SkinDimensionKey } from "@/lib/advisor-labels";
import { DIMENSION_LABELS, DIMENSION_ORDER } from "@/lib/advisor-labels";

interface ScientificBarChartProps {
    dimensions: SkinDimensions;
    activeDimension?: string | null;
    onDimensionSelect?: (key: SkinDimensionKey) => void;
    /** 低置信度维度（如带妆拍摄时的色斑/肤色/敏感度）：标签加 * 并在图上方注明 */
    lowConfidenceKeys?: SkinDimensionKey[];
}

const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981"; // Green
    if (score >= 60) return "#f59e0b"; // Yellow
    return "#ef4444"; // Red
};

export function ScientificBarChart({ dimensions, activeDimension, onDimensionSelect, lowConfidenceKeys }: ScientificBarChartProps) {
    const mounted = useMounted();
    const [initialLoad, setInitialLoad] = useState(true);
    useEffect(() => {
        // 与 animationDuration(1000ms) 对齐，动画结束后关闭以允许后续 hover 交互
        const timer = setTimeout(() => setInitialLoad(false), 1100);
        return () => clearTimeout(timer);
    }, []);

    const lowConfidenceLabels = useMemo(
        () => new Set((lowConfidenceKeys ?? []).map((key) => DIMENSION_LABELS[key]).filter(Boolean)),
        [lowConfidenceKeys]
    );

    const chartData = useMemo(() => DIMENSION_ORDER.map(key => ({
        dimension: DIMENSION_LABELS[key],
        key: key,
        score: dimensions[key]?.score,
        fullMark: 100,
    })), [dimensions]);

    if (!mounted) {
        return <div className="w-full relative mb-6" style={{ height: "480px" }} />;
    }

    return (
        <div className="w-full mb-6">
            {lowConfidenceLabels.size > 0 && (
                <p className="mb-2 text-[11px] leading-relaxed text-[#8c7a6b]">
                    * 带妆拍摄：标注 * 的维度（色斑 / 肤色均衡度 / 敏感度）置信度降低，仅供参考
                </p>
            )}
            <div className="w-full relative" style={{ height: "480px" }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 8, right: 55, bottom: 60, left: 55 }}
                    barCategoryGap="20%"
                >
                    <XAxis
                        type="number"
                        domain={[0, 100]}
                        ticks={[0, 60, 80, 100]}
                        hide
                    />
                    {/* Custom vertical grid lines: 60/80/100=dashed */}
                    <ReferenceLine x={60} stroke="#E9E9E7" strokeWidth={1} strokeDasharray="3 3" />
                    <ReferenceLine x={80} stroke="#E9E9E7" strokeWidth={1} strokeDasharray="3 3" />
                    <ReferenceLine x={100} stroke="#E9E9E7" strokeWidth={1} strokeDasharray="3 3" />
                    <YAxis
                        type="category"
                        dataKey="dimension"
                        tick={{ fontSize: 13, fill: '#8c7a6b' }}
                        axisLine={false}
                        tickLine={false}
                        width={86}
                        tickFormatter={(value: string) => (lowConfidenceLabels.has(value) ? `${value} *` : value)}
                    />
                    <Bar
                        dataKey="score"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={16}
                        isAnimationActive={initialLoad}
                        animationDuration={1000}
                        animationEasing="ease-out"
                    >
                        <LabelList
                            dataKey="score"
                            position="right"
                            content={(props: LabelProps) => {
                                // LabelList 运行时额外注入 x/y/width/index，类型定义未包含，在此收窄
                                const extra = props as LabelProps & { x?: number | string; y?: number | string; width?: number | string; index?: number };
                                const x = Number(extra.x ?? 0);
                                const y = Number(extra.y ?? 0);
                                const width = Number(extra.width ?? 0);
                                const { value } = props;
                                const index = extra.index ?? 0;
                                const data = chartData[index];
                                const isActive = activeDimension === data?.key;
                                return (
                                    <text
                                        x={x + width + 6}
                                        y={y + 12}
                                        fontSize={12}
                                        fontWeight={isActive ? 600 : 400}
                                        fill={isActive ? '#337EA9' : '#787774'}
                                        className="select-none"
                                        style={{ transition: 'none' }}
                                    >
                                        {data?.score === undefined ? '-' : value}
                                    </text>
                                );
                            }}
                        />
                        {chartData.map((entry, index) => {
                            const isActive = activeDimension === entry.key;
                            const baseColor = entry.score === undefined ? '#D9D4CC' : getScoreColor(entry.score);
                            return (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={baseColor}
                                    fillOpacity={isActive ? 1 : 0.6}
                                    stroke={isActive ? baseColor : 'none'}
                                    strokeWidth={isActive ? 2 : 0}
                                    cursor={onDimensionSelect ? "pointer" : "default"}
                                    style={{ transition: 'none' }}
                                    onClick={onDimensionSelect ? () => onDimensionSelect(entry.key as SkinDimensionKey) : undefined}
                                />
                            );
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {/* Severity indicator bar — positioned outside SVG, aligned via margins
                （paddingLeft = YAxis margin 55 + width 86，随刻度标签宽度同步） */}
            <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, paddingLeft: 141, paddingRight: 55 }}>
                {/* Scale ticks：按真实百分比定位，与渐变条分段及 ReferenceLine 对齐 */}
                <div className="relative h-4 text-[11px] text-[#787774] mb-1">
                    <span className="absolute left-0">0</span>
                    <span className="absolute left-[60%] -translate-x-1/2">60</span>
                    <span className="absolute left-[80%] -translate-x-1/2">80</span>
                    <span className="absolute right-0">100</span>
                </div>
                {/* Gradient bar */}
                <div className="h-1.5 w-full rounded-full overflow-hidden"
                    style={{
                        background: 'linear-gradient(to right, #ef4444 0%, #ef4444 60%, #eab308 60%, #eab308 80%, #22c55e 80%, #22c55e 100%)',
                        maskImage: 'linear-gradient(to right, transparent 0%, black 15%)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%)'
                    }}
                />
                {/* Labels */}
                <div className="relative mt-1.5 h-4">
                    <span className="absolute left-[60%] -translate-x-1/2 text-[11px] font-medium text-[#787774]">严重</span>
                    <span className="absolute left-[80%] -translate-x-1/2 text-[11px] font-medium text-[#787774]">中度</span>
                    <span className="absolute right-0 text-[11px] font-medium text-[#787774]">良好</span>
                </div>
            </div>
            </div>
        </div>
    );
}
