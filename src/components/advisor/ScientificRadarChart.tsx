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
import type { SkinDimensions, SkinDimensionKey } from "@/lib/advisor-utils";
import { DIMENSION_LABELS } from "@/lib/advisor-utils";

interface ScientificRadarChartProps {
    dimensions: SkinDimensions;
    size?: number;
    activeDimension?: string | null;
    onDimensionSelect?: (key: SkinDimensionKey) => void;
}

const DIMENSION_ORDER: SkinDimensionKey[] = [
    'waterOil', 'skinTone', 'spots', 'wrinkles', 
    'uvDamage', 'sensitivity', 'darkCircles', 'firmness', 'acne', 'radiance'
];

const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981"; // Emerald 500
    if (score >= 60) return "#f59e0b"; // Amber 500
    return "#ef4444"; // Red 500
};

export function ScientificRadarChart({ dimensions, size = 300, activeDimension, onDimensionSelect }: ScientificRadarChartProps) {
    const chartData = useMemo(() => DIMENSION_ORDER.map(key => ({
        dimension: DIMENSION_LABELS[key],
        key: key,
        score: dimensions[key]?.score ?? 50,
        fullMark: 100,
    })), [dimensions]);

    // Custom Tick Component for interactivity
    const CustomTick = ({ payload, x, y, textAnchor, stroke, radius }: any) => {
        const data = chartData[payload.index];
        const isActive = activeDimension === data.key;

        // Adjust text position slightly to avoid overlapping with the grid
        // We can push the text out a bit based on its angle if needed, 
        // but Recharts handles rotation fairly well. 
        // We'll just add a slight improved styling.

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
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fontSize={isActive ? 13 : 11}
                    fontWeight={isActive ? 600 : 400}
                    fill={isActive ? '#337EA9' : '#787774'} // Notion Blue / Notion Gray
                    textAnchor={textAnchor}
                    className="select-none"
                >
                    <tspan dy="0.35em">{payload.value}</tspan>
                </text>
            </g>
        );
    };

    // Custom Dot to highlight active point
    const CustomDot = (props: any) => {
        const { cx, cy, payload } = props;
        const isActive = activeDimension === payload.key;
        const color = getScoreColor(payload.score);

        const handleClick = (e: any) => {
            e.stopPropagation();
            e.preventDefault();
            onDimensionSelect?.(payload.key as SkinDimensionKey);
        };

        return (
            <g
                className="recharts-layer recharts-radar-dot"
                onClick={handleClick}
                style={{ cursor: 'pointer' }}
            >
                {/* Active Indicator Ring (Ripple effect static) */}
                {isActive && (
                    <circle cx={cx} cy={cy} r={10} fill={color} fillOpacity={0.2} />
                )}

                {/* Visible inner dot */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={isActive ? 5 : 3.5}
                    fill={color}
                    fillOpacity={1}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    className="transition-all duration-300"
                />

                {/* Click target expander */}
                <circle cx={cx} cy={cy} r={20} fill="transparent" />
            </g>
        );
    };

    return (
        <div className="w-full h-full relative" style={{ minHeight: "340px" }}>
            {/* Gradient Definitions */}
            <svg style={{ height: 0, width: 0, position: 'absolute' }}>
                <defs>
                    <linearGradient id="radarFillGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#337EA9" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#337EA9" stopOpacity={0.05} />
                    </linearGradient>
                    <radialGradient id="radarStrokeGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" stopColor="#2c3e50" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#337EA9" stopOpacity={1} />
                    </radialGradient>
                </defs>
            </svg>

            <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    data={chartData}
                    startAngle={90}
                    endAngle={-270}
                >
                    {/* Background Circles for Lab/Radar Look */}
                    <PolarGrid
                        gridType="circle"
                        stroke="#E9E9E7"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                    />

                    <PolarAngleAxis
                        dataKey="dimension"
                        tick={<CustomTick />}
                        axisLine={false}
                        tickLine={false}
                    />

                    {/* Hidden Axis for scaling */}
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                    />

                    <Radar
                        name="Skin Score"
                        dataKey="score"
                        stroke="#337EA9"
                        strokeWidth={2}
                        fill="url(#radarFillGradient)"
                        fillOpacity={1}
                        dot={<CustomDot />}
                        activeDot={false}
                        isAnimationActive={true}
                        animationDuration={1000}
                        animationEasing="ease-out"
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
