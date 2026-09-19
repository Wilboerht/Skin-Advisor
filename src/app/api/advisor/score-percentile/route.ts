import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * 综合评分真实百分位：按「每个用户最近一次含真实视觉评分的测肤（analysisSource=hybrid）」聚合，
 * 返回该分数超过的平台用户百分比。
 * - 样本不足 MIN_SAMPLE_SIZE 时返回 percentile: null（前端隐藏该行，避免小样本误导）
 * - analysisSource=text（无面部分析、无评分）与未归属游客会话不参与
 * - 归档冷层保留 faceAnalysis.overallScore，与热层一并参与
 * - 进程内 10 分钟缓存 + CDN 缓存头，避免每次展示都扫表
 */
const MIN_SAMPLE_SIZE = 50;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<number, { percentile: number | null; sampleSize: number; expiresAt: number }>();

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" };

export async function GET(request: NextRequest) {
    const raw = Number(request.nextUrl.searchParams.get("score"));
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
        return NextResponse.json({ error: "score must be a number between 0 and 100" }, { status: 400 });
    }
    const score = Math.round(raw);

    const cached = cache.get(score);
    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(
            { percentile: cached.percentile, sampleSize: cached.sampleSize },
            { headers: CACHE_HEADERS }
        );
    }

    try {
        const rows = await prisma.$queryRaw<Array<{ total: number; below: number }>>`
            WITH latest AS (
                SELECT DISTINCT ON ("userId")
                       ("analysisResult"->'faceAnalysis'->>'overallScore')::numeric AS score
                FROM "AdvisorSession"
                WHERE "userId" IS NOT NULL
                  AND "analysisSource" = 'hybrid'
                  AND "analysisResult"->'faceAnalysis'->>'overallScore' IS NOT NULL
                ORDER BY "userId", COALESCE("analysisCompletedAt", "completedAt", "createdAt") DESC
            )
            SELECT COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE score < ${score})::int AS below
            FROM latest
        `;
        const total = rows[0]?.total ?? 0;
        const below = rows[0]?.below ?? 0;
        const percentile =
            total >= MIN_SAMPLE_SIZE
                ? Math.min(99, Math.max(1, Math.round((below / total) * 100)))
                : null;

        if (cache.size > 128) cache.clear();
        cache.set(score, { percentile, sampleSize: total, expiresAt: Date.now() + CACHE_TTL_MS });

        return NextResponse.json({ percentile, sampleSize: total }, { headers: CACHE_HEADERS });
    } catch (error) {
        // 数据库不可用（如未配置 DATABASE_URL 的本地环境）：静默降级为不展示
        console.error("[score-percentile] aggregate failed:", error);
        return NextResponse.json({ percentile: null, sampleSize: 0 });
    }
}
