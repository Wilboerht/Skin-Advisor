export const DATA_RETENTION = {
    photoHours: 24,
    fullReportDays: 365,
    coldSummaryYears: 3,
    fullReportLimit: 10,
    maxReportsPerUser: 100,
} as const;

export const DATA_RETENTION_TEXT = {
    photo: `面部照片仅用于本次分析，分析完成后立即删除；异常情况下最迟 ${DATA_RETENTION.photoHours} 小时内删除。`,
    report: `完整测肤报告保留 ${DATA_RETENTION.fullReportDays} 天。`,
    coldSummary: `脱敏趋势摘要最长保留 ${DATA_RETENTION.coldSummaryYears} 年，之后自动删除。`,
} as const;

export function coldSummaryCutoff(now = new Date()): Date {
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - DATA_RETENTION.coldSummaryYears);
    return cutoff;
}
