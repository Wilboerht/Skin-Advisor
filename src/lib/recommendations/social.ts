/**
 * 协同过滤社交证明：同肤质用户报告中产品被推荐占比 + 反馈回购率。
 */

import prisma from "@/lib/prisma";
import { getPersonaLabelFromKey, getSkinTypeLabelShort } from "./reasons";

/**
 * 查询同 skinType 用户的历史推荐产品，统计每款产品被推荐的频次。
 * 返回 Map<productId, { affinity, repurchaseRate, label }>。
 */
export async function getClusterSocialProof(
    skinType: string,
    persona?: string
): Promise<Map<string, { affinity: number; repurchaseRate: number; label: string }>> {
    const result = new Map<string, { affinity: number; repurchaseRate: number; label: string }>();
    try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const clusterSessions = await prisma.advisorSession.findMany({
            where: {
                completedAt: { gte: ninetyDaysAgo },
                // 归档摘要不含 products，计入分母会让推荐占比系统性下降
                archivedAt: null,
            },
            orderBy: { completedAt: "desc" },
            take: 300,
            select: {
                analysisResult: true,
            },
        });

        if (clusterSessions.length === 0) return result;

        const productCounts = new Map<string, number>();
        let matchingSessionCount = 0;

        for (const session of clusterSessions) {
            const resultData = session.analysisResult as Record<string, unknown> | null;
            const skinProfile = (resultData?.skinProfile as Record<string, unknown>) || {};
            const sessionSkinType = (skinProfile.type as string) || "";

            if (sessionSkinType.toLowerCase() !== skinType.toLowerCase()) continue;
            matchingSessionCount++;

            const products = Array.isArray(resultData?.products)
                ? (resultData!.products as Array<Record<string, unknown>>)
                : [];
            for (const p of products) {
                const pid = p.id as string;
                if (pid) {
                    productCounts.set(pid, (productCounts.get(pid) || 0) + 1);
                }
            }
        }

        if (matchingSessionCount === 0 || productCounts.size === 0) return result;

        // 批量查询产品反馈：愿意回购比例
        const productIds = Array.from(productCounts.keys());
        const repurchaseMap = new Map<string, number>();
        try {
            const [totalAggs, repurchaseAggs] = await Promise.all([
                prisma.productFeedback.groupBy({
                    by: ["productId"],
                    where: { productId: { in: productIds } },
                    _count: { id: true },
                }),
                prisma.productFeedback.groupBy({
                    by: ["productId"],
                    where: { productId: { in: productIds }, repurchase: true },
                    _count: { id: true },
                }),
            ]);

            const totalCounts = new Map<string, number>();
            for (const agg of totalAggs) {
                totalCounts.set(agg.productId, agg._count.id);
            }
            for (const agg of repurchaseAggs) {
                const total = totalCounts.get(agg.productId) || 0;
                if (total >= 3) {
                    repurchaseMap.set(agg.productId, Math.round((agg._count.id / total) * 100));
                }
            }
        } catch {
            // 反馈查询失败不阻断主流程
        }

        const personaLabel = persona ? getPersonaLabelFromKey(persona) : "";
        for (const [productId, count] of productCounts) {
            const affinity = Math.round((count / matchingSessionCount) * 100);
            if (affinity >= 10) {
                result.set(productId, {
                    affinity,
                    repurchaseRate: repurchaseMap.get(productId) || 0,
                    label: `${getSkinTypeLabelShort(skinType)}${personaLabel ? ` · ${personaLabel}` : ""}高频推荐`,
                });
            }
        }

        return result;
    } catch (e) {
        console.warn("Cluster social proof query failed (non-fatal):", e);
        return result;
    }
}
