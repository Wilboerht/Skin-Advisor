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
import type { SkinDimensions, SkinDimensionKey } from "@/lib/advisor-utils";
import { DIMENSION_LABELS } from "@/lib/advisor-utils";

interface ScientificBarChartProps {
    dimensions: SkinDimensions;
    size?: number;
    activeDimension?: string | null;
    onDimensionSelect?: (key: SkinDimensionKey) => void;
}

const DIMENSION_ORDER: SkinDimensionKey[] = [
    'radiance', 'acne', 'firmness', 'darkCircles',
    'sensitivity', 'uvDamage', 'wrinkles', 'spots',
    'skinTone', 'waterOil'
];

const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981"; // Green
    if (score >= 60) return "#f59e0b"; // Yellow
    return "#ef4444"; // Red
};

export function ScientificBarChart({ dimensions, size = 300, activeDimension, onDimensionSelect }: ScientificBarChartProps) {
    const mounted = useMounted();
    const [initialLoad, setInitialLoad] = useState(true);
    useEffect(() => {
        // 与 animationDuration(1000ms) 对齐，动画结束后关闭以允许后续 hover 交互
        const timer = setTimeout(() => setInitialLoad(false), 1100);
        return () => clearTimeout(timer);
    }, []);

    const chartData = useMemo(() => DIMENSION_ORDER.map(key => ({
        dimension: DIMENSION_LABELS[key],
        key: key,
        score: dimensions[key]?.score ?? 50,
        fullMark: 100,
    })), [dimensions]);

    if (!mounted) {
        return <div className="w-full relative" style={{ height: "480px" }} />;
    }

    return (
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
                        width={70}
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
                            content={(props: any) => {
                                const { x, y, width, value, index } = props;
                                const data = chartData[index];
                                const isActive = activeDimension === data.key;
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
                                        {value}
                                    </text>
                                );
                            }}
                        />
                        {chartData.map((entry, index) => {
                            const isActive = activeDimension === entry.key;
                            const baseColor = getScoreColor(entry.score);
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

            {/* Severity indicator bar — positioned outside SVG, aligned via margins */}
            <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, paddingLeft: 125, paddingRight: 55 }}>
                {/* Scale ticks */}
                <div className="flex justify-between text-[11px] text-[#787774] mb-1">
                    <span>0</span>
                    <span>60</span>
                    <span>80</span>
                    <span>100</span>
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
    );
}
