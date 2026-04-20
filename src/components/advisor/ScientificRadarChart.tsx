"use client";

import { useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    XAxis,
    YAxis,
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
    'radiance', 'acne', 'firmness', 'darkCircles',
    'sensitivity', 'uvDamage', 'wrinkles', 'spots',
    'skinTone', 'waterOil'
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

    // Custom label on the right side of each bar
    const LabelContent = (props: any) => {
        const { x, y, width, value, index } = props;
        const data = chartData[index];
        const isActive = activeDimension === data.key;
        return (
            <text
                x={x + width + 8}
                y={y + 12}
                fontSize={12}
                fontWeight={isActive ? 600 : 400}
                fill={isActive ? '#337EA9' : '#787774'}
                className="select-none"
            >
                {value}
            </text>
        );
    };

    return (
        <div className="w-full h-full relative" style={{ minHeight: "400px" }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 8, right: 40, bottom: 8, left: 80 }}
                    barCategoryGap="20%"
                >
                    <CartesianGrid
                        horizontal={false}
                        stroke="#E9E9E7"
                        strokeDasharray="3 3"
                    />
                    <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#787774' }}
                        axisLine={{ stroke: '#E9E9E7' }}
                        tickLine={false}
                    />
                    <YAxis
                        type="category"
                        dataKey="dimension"
                        tick={{ fontSize: 12, fill: '#787774' }}
                        axisLine={false}
                        tickLine={false}
                        width={70}
                    />
                    <Bar
                        dataKey="score"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={24}
                        label={<LabelContent />}
                        animationDuration={1000}
                        animationEasing="ease-out"
                    >
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
                                    cursor="pointer"
                                    onClick={() => onDimensionSelect?.(entry.key as SkinDimensionKey)}
                                />
                            );
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
