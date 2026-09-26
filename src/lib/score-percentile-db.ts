/**
 * 综合评分真实百分位的 DB 聚合层（带进程内缓存）。
 *
 * 数据口径（重要）：
 * - 只看 `analysisResult.faceAnalysis.overallScore` 存在且为数值的行——analyze 落库时
 *   faceAnalysis 显式取真实 AI 视觉结果，因此"有分数"即真实评分；
 * - **不能用 `analysisSource = 'hybrid'` 过滤**：前端埋点会把该字段覆写为 'ai' / 'fallback'，落库值不稳定；
 * - 每个 userId 只取最近一次（DISTINCT ON），与"超过 X% 的测肤用户"文案口径一致；
 * - 归档冷层保留 faceAnalysis.overallScore，一并参与。
 *
 * 性能：一次查询取全量分数直方图（≤101 桶）并全局缓存，任意 score 由缓存求累计，
 * 避免按 score 缓存被刷导致重复扫表；样本不足时 percentileFromDistribution 返回 null。
 */
import prisma from "@/lib/prisma";
import { buildDistribution, type ScoreDistribution } from "@/lib/score-percentile";

const CACHE_TTL_MS = 10 * 60 * 1000;

interface DistributionCache {
    dist: ScoreDistribution;
    expiresAt: number;
}

let cache: DistributionCache | null = null;
let refreshPromise: Promise<ScoreDistribution> | null = null;

async function loadDistribution(): Promise<ScoreDistribution> {
    // 正则先保证可安全转 numeric（源码里 \\ 转义后 SQL 实际收到 \.）：桶按显示分数四舍五入取整
    const rows = await prisma.$queryRaw<Array<{ score: number; count: number }>>`
        WITH latest AS (
            SELECT DISTINCT ON ("userId")
                   ROUND(("analysisResult"->'faceAnalysis'->>'overallScore')::numeric)::int AS score,
                   COALESCE("analysisCompletedAt", "completedAt", "createdAt") AS ordered_at
            FROM "AdvisorSession"
            WHERE "userId" IS NOT NULL
              AND ("analysisResult"->'faceAnalysis'->>'overallScore') ~ '^[0-9]+(\\.[0-9]+)?$'
            ORDER BY "userId", ordered_at DESC
        )
        SELECT score, COUNT(*)::int AS count
        FROM latest
        GROUP BY score
        ORDER BY score
    `;
    return buildDistribution(rows);
}

/**
 * 获取全站评分分布（10 分钟缓存 + 并发防击穿）。
 * 前端百分位接口与内部客服报告接口共用，保证全站口径一致。
 */
export async function getScoreDistribution(): Promise<ScoreDistribution> {
    if (cache && cache.expiresAt > Date.now()) return cache.dist;
    // 并发防击穿：同一次刷新只发一条查询
    if (!refreshPromise) {
        refreshPromise = loadDistribution()
            .then((dist) => {
                cache = { dist, expiresAt: Date.now() + CACHE_TTL_MS };
                return dist;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
}
