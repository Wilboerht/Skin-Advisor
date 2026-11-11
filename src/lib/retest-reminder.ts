/**
 * 生成“4 周后复测”日历提醒（ICS，兼容 iOS 日历/Outlook/Google Calendar）。
 * 纯函数，便于单测；不依赖服务端。
 */

export interface RetestReminderInput {
    /** 本次测肤完成时间（ISO） */
    analyzedAt?: string | null;
    /** 报告/会话 ID，用于生成稳定 UID */
    sessionId?: string | null;
    /** 复测时重点关注的维度 */
    focus?: string[];
    /** 间隔天数，默认 28 天 */
    days?: number;
}

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

/** 取上海时区的 YYYYMMDD（避免用户时区不同导致提醒日期偏移） */
function shanghaiDateParts(date: Date): { y: number; m: number; d: number } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    return { y: get("year"), m: get("month"), d: get("day") };
}

function toUtcStamp(date: Date): string {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcs(text: string): string {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");
}

export function buildRetestReminderIcs(input: RetestReminderInput = {}): string {
    const base = input.analyzedAt ? new Date(input.analyzedAt) : new Date();
    const validBase = Number.isNaN(base.getTime()) ? new Date() : base;
    const days = Number.isFinite(input.days) && (input.days as number) > 0 ? Math.round(input.days as number) : 28;
    const start = new Date(validBase.getTime() + days * 24 * 60 * 60 * 1000);
    const { y, m, d } = shanghaiDateParts(start);
    const dtStart = `${y}${pad(m)}${pad(d)}T100000`;
    const dtEnd = `${y}${pad(m)}${pad(d)}T103000`;
    const focus = (input.focus ?? []).filter(Boolean).slice(0, 3);
    const description = [
        "肌智派建议：同一光线、素颜拍摄，4 周后复测对比更可靠。",
        focus.length > 0 ? `复测重点：${focus.join("、")}。` : "",
        "本提醒由 AI 测肤报告生成，仅供日常护理参考，不构成医疗诊断。",
    ].filter(Boolean).join("\n");

    const uid = `retest-${(input.sessionId || "report").replace(/[^a-zA-Z0-9-]/g, "")}@smart.nihplod.cn`;

    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//NIHPLOD//Skin Retest//CN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${toUtcStamp(new Date())}`,
        `DTSTART;TZID=Asia/Shanghai:${dtStart}`,
        `DTEND;TZID=Asia/Shanghai:${dtEnd}`,
        "SUMMARY:肌智派复测提醒",
        `DESCRIPTION:${escapeIcs(description)}`,
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        "DESCRIPTION:肌智派复测提醒",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");
}
