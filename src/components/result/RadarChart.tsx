"use client";

import {
  Radar,
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { RadarDimension } from "@/lib/result-content";

interface RadarChartProps {
  data: RadarDimension[];
  fillColor?: string;
  strokeColor?: string;
}

export default function RadarChart({
  data,
  fillColor = "#1B3A5C",
  strokeColor = "#B76E79",
}: RadarChartProps) {
  const chartData = data.map((d) => ({
    subject: d.dimension,
    score: d.score,
    fullMark: 100,
    interpretation: d.interpretation,
  }));

  return (
    <div className="w-full h-[360px] md:h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <ReRadarChart data={chartData} margin={{ top: 24, right: 48, bottom: 24, left: 48 }}>
          <PolarGrid stroke="rgba(27,58,92,0.15)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#2C2C2C", fontSize: 13, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "#8A8A8A", fontSize: 10 }}
            tickCount={6}
            axisLine={false}
          />
          <Radar
            name="肌肤评分"
            dataKey="score"
            stroke={strokeColor}
            strokeWidth={2}
            fill={fillColor}
            fillOpacity={0.25}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as {
                  subject: string;
                  score: number;
                  interpretation: string;
                };
                return (
                  <div className="bg-white/95 backdrop-blur border border-[#E8E2D9] rounded-lg p-3 shadow-lg max-w-[240px]">
                    <p className="text-sm font-semibold text-[#1A1A1A]">
                      {item.subject}: {item.score}
                    </p>
                    <p className="text-xs text-[#5E5E5E] mt-1 leading-relaxed">
                      {item.interpretation}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
        </ReRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
