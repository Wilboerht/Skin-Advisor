/**
 * 时间工具：全线固定 Asia/Shanghai (UTC+8) 计算日界与解析时间
 *
 * 背景：生产容器可能以 UTC 部署，直接使用 new Date()/setHours(0,0,0,0)
 * 会按服务器本地时区计算日界，导致每日限额、今日统计等在北京时间 08:00 才切换。
 * 本模块的所有函数均不依赖服务器时区。
 */

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 返回"北京时间当日零点"对应的 Date（UTC 绝对时刻）。
 * 例如北京时间 2025-01-15 10:00 调用，返回 2025-01-15T00:00:00+08:00。
 */
export function startOfTodayShanghai(now: Date = new Date()): Date {
    const shifted = now.getTime() + SHANGHAI_OFFSET_MS;
    const dayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
    return new Date(dayStartShifted - SHANGHAI_OFFSET_MS);
}

/**
 * 解析 datetime-local 格式（yyyy-MM-ddTHH:mm[:ss]）为北京时间，
 * 返回对应的 UTC 绝对时刻；格式非法返回 null。
 */
export function parseBeijingDateTime(value: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
    if (!m) return null;
    const [, y, mo, d, h, mi, s] = m;
    const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0)) - SHANGHAI_OFFSET_MS;
    const date = new Date(utcMs);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * 解析 yyyy-MM-dd 为"该日北京时间零点"；格式非法返回 null。
 */
export function parseBeijingDate(value: string): Date | null {
    return parseBeijingDateTime(`${value.trim()}T00:00`);
}

/**
 * 解析前端提交的时间输入（后台表单等）：
 * - 带显式时区（Z 或 ±HH:mm）的字符串按原生规则解析
 * - 无时区的 datetime-local 固定按北京时间解析（避免按服务器时区漂移）
 * 非法输入返回 null。
 */
export function parseUserInputDateTime(value: string): Date | null {
    const v = value.trim();
    if (!v) return null;
    if (/(Z|[+-]\d{2}:?\d{2})$/.test(v)) {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    }
    return parseBeijingDateTime(v);
}
