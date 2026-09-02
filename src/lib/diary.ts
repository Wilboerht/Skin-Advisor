import prisma from "@/lib/prisma";

/** date 字段语义：客户端本地日历日（YYYY-MM-DD），按 UTC 零点存储，不依赖服务器时区 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseClientDate(dateStr: string): Date | null {
    if (!DATE_RE.test(dateStr)) return null;
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** 测肤综合评分 → 日记肌肤状态档位 */
export function scoreToSkinState(score: number): string {
    if (score >= 85) return "great";
    if (score >= 70) return "good";
    if (score >= 55) return "normal";
    if (score >= 40) return "bad";
    return "terrible";
}

interface AutoDiaryInput {
    userId: string;
    /** 客户端本地日历日 YYYY-MM-DD */
    dateStr: string;
    score: number;
    skinTypeLabel?: string | null;
}

/**
 * 测肤完成后自动生成/更新当日日记条目（upsert by userId+date）。
 * 同日多次测肤时以最新一次为准。
 */
export async function upsertAutoDiaryEntry({ userId, dateStr, score, skinTypeLabel }: AutoDiaryInput) {
    const date = parseClientDate(dateStr);
    if (!date) return null;

    const roundedScore = Math.round(score);
    const note = [`在线测肤 · 综合评分 ${roundedScore} 分`, skinTypeLabel].filter(Boolean).join(" · ");

    return prisma.diaryEntry.upsert({
        where: { userId_date: { userId, date } },
        update: { skinState: scoreToSkinState(roundedScore), tags: [], note },
        create: { userId, date, skinState: scoreToSkinState(roundedScore), tags: [], note }
    });
}
