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

/** 白皮书统计行：从测肤会话提取的脱敏统计字段（热层/冷层通吃） */
export interface SessionStats {
    /** 肤质拟人化 IP key（8 派） */
    persona: string | null;
    /** 诊断肤质类型标签 */
    skinTypeLabel: string | null;
    /** 综合评分 */
    overallScore: number | null;
    /** 维度评分：皱纹/水油/色斑/纹理 */
    dimensions: { wrinkles: number | null; waterOil: number | null; spots: number | null; texture: number | null } | null;
    /** 问卷脱敏白名单字段 */
    ageRange: string | null;
    budget: string | null;
    selfSkinType: string | null;
    primaryConcern: string | null;
}

/**
 * 提取脱敏统计字段：热层读完整 answers/analysisResult，
 * 冷层读归档摘要（analysisResult.profile / faceAnalysis），敏感字段一律不取。
 * 供白皮书数据导出等群体统计场景使用。
 */
export function extractSessionStats(
    analysisResult: unknown,
    answers: unknown
): SessionStats {
    const result = (analysisResult ?? null) as Record<string, unknown> | null;
    const ans = (answers ?? null) as Record<string, unknown> | null;

    const faceAnalysis = result?.faceAnalysis as Record<string, unknown> | undefined;
    const skinAnalysis = result?.skinAnalysis as Record<string, unknown> | undefined;
    // 冷层摘要：白名单字段在 analysisResult.profile 下
    const profile = result?.profile as Record<string, unknown> | undefined;
    const dims = faceAnalysis?.dimensions as Record<string, { score?: number } | undefined> | undefined;

    const pick = (key: (typeof ANSWERS_WHITELIST)[number]): unknown =>
        ans?.[key] ?? profile?.[key === "skinType" ? "selfSkinType" : key] ?? null;

    const asStringList = (v: unknown): string | null =>
        Array.isArray(v) ? v.join("、") : v != null ? String(v) : null;

    return {
        persona: (result?.persona as string | undefined) ?? null,
        skinTypeLabel: (skinAnalysis?.typeLabel as string | undefined) ?? null,
        overallScore: (faceAnalysis?.overallScore as number | undefined) ?? null,
        dimensions: dims
            ? {
                wrinkles: dims.wrinkles?.score ?? null,
                waterOil: dims.waterOil?.score ?? null,
                spots: dims.spots?.score ?? null,
                texture: dims.texture?.score ?? null,
            }
            : null,
        ageRange: asStringList(pick("ageRange")),
        budget: asStringList(pick("budget")),
        selfSkinType: asStringList(pick("skinType")),
        primaryConcern: asStringList(pick("primaryConcern")),
    };
}

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
