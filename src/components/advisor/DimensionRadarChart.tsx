"use client";

import { useMemo } from "react";
import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from "recharts";
import { useMounted } from "@/hooks/use-mounted";
import type { SkinDimensionKey, SkinDimensions } from "@/lib/advisor-utils";
import { DIMENSION_LABELS, DIMENSION_ORDER } from "@/lib/advisor-utils";

interface DimensionRadarChartProps {
    dimensions: SkinDimensions;
}

/**
 * 十维评分雷达图：报告页数据总览。
 * 仅展示有真实分数的维度；有效维度不足 3 个（无法构成面）时不渲染。
 */
export function DimensionRadarChart({ dimensions }: DimensionRadarChartProps) {
    const mounted = useMounted();

    const chartData = useMemo(
        () =>
            DIMENSION_ORDER
                .map((key) => ({
                    key,
                    label: DIMENSION_LABELS[key],
                    score: dimensions[key]?.score,
                }))
                .filter((d): d is { key: SkinDimensionKey; label: string; score: number } => typeof d.score === "number"),
        [dimensions]
    );

    // 少于 3 个有效维度画不出面，视为无数据
    if (chartData.length < 3) return null;

    // SSR/水合前占位，避免 ResponsiveContainer 尺寸测量抖动
    if (!mounted) {
        return <div className="w-full" style={{ height: 320 }} aria-hidden="true" />;
    }

    return (
        <div className="w-full" style={{ height: 320 }} role="img" aria-label="十维肌肤评分雷达图">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} outerRadius="72%" margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
                    <PolarGrid stroke="#5c4937" strokeOpacity={0.12} />
                    <PolarAngleAxis
                        dataKey="label"
                        tick={{ fill: "#7a6552", fontSize: 11, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                        dataKey="score"
                        stroke="#8B7355"
                        strokeWidth={2}
                        fill="#8B7355"
                        fillOpacity={0.22}
                        isAnimationActive
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}

export default DimensionRadarChart;
