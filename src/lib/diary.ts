import prisma from "@/lib/prisma";
import {
    AUTO_DIARY_NOTE_PREFIX,
    isAutoDiaryEntry,
    isDiaryDateInRange,
    parseClientDate,
    scoreToSkinState
} from "@/lib/diary-utils";

export {
    AUTO_DIARY_NOTE_PREFIX,
    isAutoDiaryEntry,
    isDiaryDateInRange,
    parseClientDate,
    scoreToSkinState
};

interface AutoDiaryInput {
    userId: string;
    /** 客户端本地日历日 YYYY-MM-DD */
    dateStr: string;
    score: number;
    skinTypeLabel?: string | null;
}

/**
 * 测肤完成后自动生成/更新当日日记条目（upsert by userId+date）。
 * - 同日多次测肤时以最新一次为准；
 * - 日期仅允许写入窗口内的日历日（与打卡 POST 一致），异常/越界日期直接忽略；
 * - 当日已有手动打卡（非自动备注或带情境标签）时保留用户数据，绝不覆盖。
 */
export async function upsertAutoDiaryEntry({ userId, dateStr, score, skinTypeLabel }: AutoDiaryInput) {
    const date = parseClientDate(dateStr);
    if (!date || !isDiaryDateInRange(date)) return null;

    const roundedScore = Math.round(score);
    const skinState = scoreToSkinState(roundedScore);
    const note = [`${AUTO_DIARY_NOTE_PREFIX} · 综合评分 ${roundedScore} 分`, skinTypeLabel].filter(Boolean).join(" · ");

    // 已有手动打卡时保留用户数据：手动备注或情境标签视为用户手写内容，不覆盖
    const existing = await prisma.diaryEntry.findUnique({
        where: { userId_date: { userId, date } },
        select: { note: true, tags: true }
    });
    if (existing) {
        const manual =
            !isAutoDiaryEntry(existing) ||
            ((existing.tags as unknown[] | null)?.length ?? 0) > 0;
        if (manual) return existing;
    }

    return prisma.diaryEntry.upsert({
        where: { userId_date: { userId, date } },
        // 仅更新自动生成的字段；tags 保持为空数组（自动记录无情境标签）
        update: { skinState, note },
        create: { userId, date, skinState, tags: [], note }
    });
}
