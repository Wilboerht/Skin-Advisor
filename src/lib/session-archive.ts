/**
 * 冷热分层归档：把完整测肤报告"脱水"为脱敏统计摘要（冷层）。
 *
 * 策略（见战略报告「长期资产」定义）：
 * - 每用户最近 N 条已完成报告保留完整数据（热层，用户可见）；
 * - 更早的报告由 data-cleanup 调用本模块就地脱水：
 *   - 清除 answers（含过敏史/孕期/医美等敏感个人信息，白名单外的字段一律不留）
 *   - analysisResult 压缩为本摘要（仅分数/肤质等统计维度）
 *   - 打上 archivedAt 标记，用户对冷层不可见
 * - 摘要保留 userId 关联与分数时间序列，供趋势对比（跨多年不断档）
 *   与白皮书群体统计（肤质 × 年龄段 × 地域）使用。
 *
 * 注意：faceAnalysis 的字段形状与 skin-trends 读取逻辑保持兼容
 * （overallScore / dimensions.{wrinkles,waterOil,spots,texture}.score），
 * 修改结构时同步检查 src/app/api/user/skin-trends/route.ts。
 */

export interface ArchivedSessionSummary {
    archived: true;
    /** 肤质拟人化 IP key（8 派） */
    persona: string | null;
    /** 肤质类型标签（与报告页 metadata 读取路径兼容：skinAnalysis.typeLabel） */
    skinAnalysis: { typeLabel: string | null } | null;
    /** 面部评分明细（形状与 skin-trends 读取兼容） */
    faceAnalysis: {
        overallScore: number | null;
        dimensions: unknown;
    } | null;
    /** 问卷脱敏白名单字段（白皮书群体统计用）；敏感字段（过敏史/孕期/医美/生理周期）不进冷层 */
    profile: {
        ageRange: unknown;
        budget: unknown;
        selfSkinType: unknown;
        primaryConcern: unknown;
    } | null;
}

const ANSWERS_WHITELIST = ["ageRange", "budget", "skinType", "primaryConcern"] as const;

export function buildArchivedSummary(
    analysisResult: unknown,
    answers: unknown
): ArchivedSessionSummary {
    const result = (analysisResult ?? null) as Record<string, unknown> | null;
    const ans = (answers ?? null) as Record<string, unknown> | null;

    const faceAnalysis = result?.faceAnalysis as Record<string, unknown> | undefined;
    const skinAnalysis = result?.skinAnalysis as Record<string, unknown> | undefined;

    const hasProfile = ans !== null && ANSWERS_WHITELIST.some((k) => ans[k] !== undefined);

    return {
        archived: true,
        persona: (result?.persona as string | undefined) ?? null,
        skinAnalysis: skinAnalysis
            ? { typeLabel: (skinAnalysis.typeLabel as string | undefined) ?? null }
            : null,
        faceAnalysis: faceAnalysis
            ? {
                overallScore: (faceAnalysis.overallScore as number | undefined) ?? null,
                dimensions: faceAnalysis.dimensions ?? null,
            }
            : null,
        profile: hasProfile
            ? {
                ageRange: ans?.ageRange ?? null,
                budget: ans?.budget ?? null,
                selfSkinType: ans?.skinType ?? null,
                primaryConcern: ans?.primaryConcern ?? null,
            }
            : null,
    };
}
