/**
 * 测肤记录查询（公共路由 /api/advisor/history 与内部接口共用）
 *
 * - page：页码（offset 分页）
 * - before：游标分页（只取该完成时间之前的记录），追加式"加载更早"专用——
 *   offset 分页在分页期间新增测肤时会漂移，游标不会
 * - lite：只回传时间线/列表所需字段（score + 肤质标签 + 派系），
 *   裁剪掉产品推荐等大 JSON，节省带宽
 *
 * 注意：游客会话的 IP 懒认领（lazyClaimGuestSessions）不在此模块，
 * 只保留在公共路由——服务器间调用（内部接口）无法代表真实客户端 IP。
 */
import prisma from "@/lib/prisma";

export interface TestHistoryQuery {
    page: number;
    limit: number;
    lite: boolean;
    before: Date | null;
}

export interface TestHistoryPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export async function getTestHistory(
    userId: string,
    query: TestHistoryQuery
): Promise<{ history: unknown[]; pagination: TestHistoryPagination }> {
    const { page, limit, lite, before } = query;
    const skip = (page - 1) * limit;
    const beforeValid = before && !Number.isNaN(before.getTime()) ? before : null;

    const sessionWhere = {
        userId,
        completedAt: beforeValid ? { lt: beforeValid } : { not: null },
        archivedAt: null, // 冷层归档摘要对用户不可见
    };

    const [history, total] = await Promise.all([
        prisma.advisorSession.findMany({
            where: sessionWhere,
            orderBy: { completedAt: "desc" },
            select: {
                sessionId: true,
                completedAt: true,
                analysisResult: true,
            },
            // 游标模式下 skip 无意义（where 已截断），page 模式保持原逻辑
            skip: beforeValid ? 0 : skip,
            take: limit,
        }),
        prisma.advisorSession.count({
            where: {
                userId,
                completedAt: { not: null },
                archivedAt: null,
            },
        }),
    ]);

    const payload = lite
        ? history.map((s) => {
            const result = s.analysisResult as Record<string, unknown> | null | undefined;
            const face = (result?.faceAnalysis ?? null) as { overallScore?: unknown } | null | undefined;
            const skinProfile = (result?.skinProfile ?? null) as { typeLabel?: unknown } | null | undefined;
            const skinAnalysis = (result?.skinAnalysis ?? null) as { typeLabel?: unknown } | null | undefined;
            const score = typeof face?.overallScore === "number" ? face.overallScore : undefined;
            const typeLabel =
                typeof skinProfile?.typeLabel === "string" ? skinProfile.typeLabel
                : typeof skinAnalysis?.typeLabel === "string" ? skinAnalysis.typeLabel
                : undefined;
            const persona = typeof result?.persona === "string" ? result.persona : undefined;
            return {
                sessionId: s.sessionId,
                completedAt: s.completedAt,
                analysisResult: {
                    ...(score != null ? { faceAnalysis: { overallScore: score } } : {}),
                    ...(typeLabel ? { skinProfile: { typeLabel } } : {}),
                    ...(persona ? { persona } : {}),
                },
            };
        })
        : history;

    return {
        history: payload,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
