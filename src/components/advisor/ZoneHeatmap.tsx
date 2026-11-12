"use client";

import type { ZoneAnalysis, ZoneData } from "@/lib/advisor-utils";
import { getScoreBand } from "@/lib/score-bands";

const ZONE_LABELS: Record<string, string> = {
    forehead: "额头",
    tZone: "T区",
    leftCheek: "左脸颊",
    rightCheek: "右脸颊",
    eyeArea: "眼周",
    jawline: "下颌线",
};

const ZONE_SCORE_KEYS = ["oil", "texture", "wrinkles", "spots", "redness", "darkCircles", "firmness", "contour"] as const;

function zoneAverage(zone: ZoneData | undefined): number | null {
    if (!zone) return null;
    const values = ZONE_SCORE_KEYS
        .map((key) => zone[key])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function fillFor(zone: ZoneData | undefined): { fill: string; fillOpacity: number; label: string } {
    const average = zoneAverage(zone);
    if (average === null) return { fill: "#D9D0C3", fillOpacity: 0.35, label: "无数据" };
    const band = getScoreBand(average);
    return {
        fill: band?.color ?? "#8B7355",
        fillOpacity: average >= 70 ? 0.22 : average >= 55 ? 0.34 : 0.46,
        label: `${average} 分`,
    };
}

interface ZoneHeatmapProps {
    zoneAnalysis?: ZoneAnalysis;
    className?: string;
}

/**
 * 区域热力图：用示意脸型 + 区域健康度着色，不展示用户照片。
 * 颜色越深代表该区域越需要关注；数值仍以区域卡片为准。
 */
export function ZoneHeatmap({ zoneAnalysis, className }: ZoneHeatmapProps) {
    if (!zoneAnalysis) return null;

    const zones = [
        { key: "forehead", shape: <ellipse cx="100" cy="58" rx="52" ry="25" /> },
        { key: "eyeArea", shape: <ellipse cx="100" cy="105" rx="48" ry="16" /> },
        { key: "tZone", shape: <rect x="88" y="80" width="24" height="90" rx="12" /> },
        { key: "leftCheek", shape: <ellipse cx="62" cy="145" rx="27" ry="36" /> },
        { key: "rightCheek", shape: <ellipse cx="138" cy="145" rx="27" ry="36" /> },
        { key: "jawline", shape: <path d="M 42 168 Q 100 252 158 168 Q 100 220 42 168 Z" /> },
    ] as const;

    return (
        <div className={className}>
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-brand-espresso)]/10 bg-white/55 p-4 sm:flex-row sm:items-center">
                <svg viewBox="0 0 200 260" className="mx-auto h-[220px] w-[170px] shrink-0" role="img" aria-label="区域肌肤状态示意图">
                    <ellipse cx="100" cy="128" rx="78" ry="108" fill="#FBF8F3" stroke="#8B7355" strokeOpacity="0.18" />
                    <path d="M 30 96 Q 100 20 170 96" fill="none" stroke="#8B7355" strokeOpacity="0.12" strokeWidth="1.5" />
                    {zones.map(({ key, shape }) => {
                        const zone = zoneAnalysis[key as keyof ZoneAnalysis];
                        const style = fillFor(zone);
                        return (
                            <g
                                key={key}
                                fill={style.fill}
                                fillOpacity={style.fillOpacity}
                                stroke={style.fill}
                                strokeOpacity="0.45"
                                strokeWidth="1"
                            >
                                <title>{`${ZONE_LABELS[key]}：${style.label}`}</title>
                                {shape}
                            </g>
                        );
                    })}
                    <ellipse cx="72" cy="104" rx="7" ry="4" fill="#5c4937" fillOpacity="0.45" />
                    <ellipse cx="128" cy="104" rx="7" ry="4" fill="#5c4937" fillOpacity="0.45" />
                    <path d="M 100 112 L 94 140 L 106 140 Z" fill="#5c4937" fillOpacity="0.18" />
                    <path d="M 84 174 Q 100 184 116 174" fill="none" stroke="#5c4937" strokeOpacity="0.32" strokeWidth="2" strokeLinecap="round" />
                </svg>

                <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[var(--color-brand-espresso)]">区域状态示意</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-brand-taupe)]">
                        颜色越深代表该区域越需要关注；这是示意图，不是照片。
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                        {(Object.keys(ZONE_LABELS) as Array<keyof typeof ZONE_LABELS>).map((key) => {
                            const zone = zoneAnalysis[key as keyof ZoneAnalysis];
                            const style = fillFor(zone);
                            return (
                                <div key={key} className="flex items-center gap-1.5 text-[11px] text-[var(--color-brand-cocoa)]">
                                    <span className="h-2 w-2 rounded-full" style={{ background: style.fill, opacity: 0.75 }} />
                                    <span className="truncate">{ZONE_LABELS[key]}</span>
                                    <span className="ml-auto tabular-nums text-[var(--color-brand-taupe)]">{style.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
