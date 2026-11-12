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
 * 避免按 score 缓存被刷导致重复扫表；样本不足时 percentileFromDistribution 返回 null，
 * 前端不展示具体排名，绝不编造“超过 X%”。
 */
import prisma from "@/lib/prisma";
import { buildDistribution, MIN_PERCENTILE_SAMPLE_SIZE, type ScoreDistribution } from "@/lib/score-percentile";
import { getSharedJson, setSharedJson } from "@/lib/shared-cache";

const CACHE_TTL_MS = 10 * 60 * 1000;
const SHARED_CACHE_KEY = "advisor:score-distribution:v1";

interface DistributionCache {
    dist: ScoreDistribution;
    expiresAt: number;
}

let cache: DistributionCache | null = null;
let refreshPromise: Promise<ScoreDistribution> | null = null;

async function loadDistribution(): Promise<ScoreDistribution> {
    // 优先读 SkinAssessment 汇总表（同样的“每用户最近一次”口径，但不解析大 JSON）。
    // 回填完成前样本可能不足，低于最小样本时继续走旧 JSON，避免百分位突然失真。
    const assessmentRows = await prisma.$queryRaw<Array<{ score: number; count: number }>>`
        WITH latest AS (
            SELECT DISTINCT ON ("userId")
                   ROUND("overallScore")::int AS score,
                   "completedAt" AS ordered_at
            FROM "SkinAssessment"
            WHERE "userId" IS NOT NULL
              AND "overallScore" IS NOT NULL
              AND "overallScore" > 0
            ORDER BY "userId", "completedAt" DESC
        )
        SELECT score, COUNT(*)::int AS count
        FROM latest
        GROUP BY score
        ORDER BY score
    `;
    const assessmentTotal = assessmentRows.reduce((sum, row) => sum + row.count, 0);
    if (assessmentTotal >= MIN_PERCENTILE_SAMPLE_SIZE) {
        // 回填只完成一部分时汇总表会低估样本；覆盖全部已完成会话后再切换口径
        const [assessmentCount, completedCount] = await Promise.all([
            prisma.skinAssessment.count(),
            prisma.advisorSession.count({ where: { completedAt: { not: null } } }),
        ]);
        if (assessmentCount >= completedCount) {
            return buildDistribution(assessmentRows);
        }
    }

    // 正则先保证可安全转 numeric（源码里 \\ 转义后 SQL 实际收到 \.）：桶按显示分数四舍五入取整
    const rows = await prisma.$queryRaw<Array<{ score: number; count: number }>>`
        WITH latest AS (
            SELECT DISTINCT ON ("userId")
                   ROUND(("analysisResult"->'faceAnalysis'->>'overallScore')::numeric)::int AS score,
                   COALESCE("analysisCompletedAt", "completedAt", "createdAt") AS ordered_at
            FROM "AdvisorSession"
            WHERE "userId" IS NOT NULL
              -- 排除 face-analyze 的中间态（只有 faceAnalysis、报告未完成）
              AND "completedAt" IS NOT NULL
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
        refreshPromise = (async () => {
            // 多实例优先读共享缓存；Redis 未配置时 shared-cache 自动回落内存
            const shared = await getSharedJson<ScoreDistribution>(SHARED_CACHE_KEY);
            if (shared && Array.isArray(shared.buckets) && typeof shared.total === "number") {
                cache = { dist: shared, expiresAt: Date.now() + CACHE_TTL_MS };
                return shared;
            }
            const dist = await loadDistribution();
            cache = { dist, expiresAt: Date.now() + CACHE_TTL_MS };
            await setSharedJson(SHARED_CACHE_KEY, dist, Math.floor(CACHE_TTL_MS / 1000));
            return dist;
        })().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}
