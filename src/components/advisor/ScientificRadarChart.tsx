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
    activeDimension?: string | null;
    onDimensionSelect?: (key: SkinDimensionKey) => void;
}

const DIMENSION_ORDER: SkinDimensionKey[] = [
    'waterOil', 'pores', 'skinTone', 'spots', 'wrinkles', 'skinTypeScore',
    'uvDamage', 'sensitivity', 'darkCircles', 'firmness', 'acne', 'radiance'
];
// Reordered slightly to distribute commonly paired attributes if needed, but standard order is fine.

const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981"; // Emerald 500
    if (score >= 60) return "#f59e0b"; // Amber 500
    return "#ef4444"; // Red 500
};

export function ScientificRadarChart({ dimensions, size = 300, activeDimension, onDimensionSelect }: ScientificRadarChartProps) {
    const chartData = DIMENSION_ORDER.map(key => ({
        dimension: DIMENSION_LABELS[key],
        key: key,
        score: dimensions[key]?.score ?? 50,
        fullMark: 100,
    }));

    // Custom Tick Component for interactivity
    const CustomTick = ({ payload, x, y, textAnchor, stroke, radius }: any) => {
        const data = chartData[payload.index];
        const isActive = activeDimension === data.key;

        return (
            <g
                className="cursor-pointer transition-all duration-200"
                onClick={() => onDimensionSelect?.(data.key as SkinDimensionKey)}
            >
                <text
                    radius={radius}
                    stroke={stroke}
                    x={x}
                    y={y}
                    font-family={isActive ? "monospace" : "sans-serif"}
                    className={`text-xs select-none ${isActive ? 'font-bold fill-blue-600' : 'fill-gray-500'}`}
                    textAnchor={textAnchor}
                >
                    <tspan dy="0em">{payload.value}</tspan>
                </text>
            </g>
        );
    };

    // Custom Dot to highlight active point
    const CustomDot = (props: any) => {
        const { cx, cy, payload } = props;
        const isActive = activeDimension === payload.key;

        const handleClick = (e: any) => {
            e.stopPropagation();
            e.preventDefault();
            onDimensionSelect?.(payload.key as SkinDimensionKey);
        };

        return (
            <g
                className="recharts-layer recharts-radar-dot"
                onClick={handleClick}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
            >
                {/* Invisible larger hit area for easier clicking */}
                <circle cx={cx} cy={cy} r={20} fill="#ffffff" fillOpacity={0} />

                {/* Visible inner dot */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={isActive ? 6 : 4}
                    fill={getScoreColor(payload.score)}
                    fillOpacity={isActive ? 1 : 0.6}
                    stroke={isActive ? "#fff" : "none"}
                    strokeWidth={isActive ? 2 : 0}
                    className={`transition-all duration-300 ${isActive ? 'drop-shadow-md' : 'hover:fill-opacity-100'}`}
                />
            </g>
        );
    };

    return (
        <div className="w-full h-full relative outline-none focus:outline-none" style={{ minHeight: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                    <PolarGrid gridType="polygon" stroke="#e5e5e5" />
                    <PolarAngleAxis
                        dataKey="dimension"
                        tick={<CustomTick />}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                        name="Skin Score"
                        dataKey="score"
                        stroke="#000000"
                        strokeWidth={1.5}
                        fill="#000000"
                        fillOpacity={0.05}
                        dot={<CustomDot />}
                        activeDot={false}
                        isAnimationActive={true}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
