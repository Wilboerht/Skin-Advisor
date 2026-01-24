"use client";

import { useState } from "react";
import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import type { SkinDimensions, SkinDimensionKey } from "@/lib/advisor-utils";
import { DIMENSION_LABELS } from "@/lib/advisor-utils";

interface ScientificRadarChartProps {
    dimensions: SkinDimensions;
    size?: number;
}

const DIMENSION_ORDER: SkinDimensionKey[] = [
    "spots", "wrinkles", "texture", "pores",
    "uvDamage", "brownSpots", "redAreas", "acneRisk"
];

const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981"; // Emerald 500
    if (score >= 60) return "#f59e0b"; // Amber 500
    return "#ef4444"; // Red 500
};

export function ScientificRadarChart({ dimensions, size = 300 }: ScientificRadarChartProps) {
    const chartData = DIMENSION_ORDER.map(key => ({
        dimension: DIMENSION_LABELS[key],
        score: dimensions[key]?.score ?? 50,
        fullMark: 100,
    }));

    return (
        <div className="w-full h-full" style={{ minHeight: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                    <PolarGrid gridType="polygon" stroke="#e5e5e5" />
                    <PolarAngleAxis
                        dataKey="dimension"
                        tick={{ fill: '#666', fontSize: 12 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                        name="Skin Score"
                        dataKey="score"
                        stroke="#000000"
                        strokeWidth={2}
                        fill="#000000"
                        fillOpacity={0.1}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-white border border-gray-200 p-2 shadow-lg rounded text-xs">
                                        <p className="font-bold mb-1">{data.dimension}</p>
                                        <p style={{ color: getScoreColor(data.score) }}>
                                            得分: {data.score}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
