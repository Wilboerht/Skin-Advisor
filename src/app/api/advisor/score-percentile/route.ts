import { NextRequest, NextResponse } from "next/server";
import { getScoreDistribution } from "@/lib/score-percentile-db";
import { percentileFromDistribution } from "@/lib/score-percentile";

/**
 * 综合评分真实百分位：按「每个用户最近一次含真实视觉评分的测肤」聚合。
 * 聚合与缓存实现见 lib/score-percentile-db.ts（内部客服报告接口共用同一口径）。
 */
export async function GET(request: NextRequest) {
    const raw = Number(request.nextUrl.searchParams.get("score"));
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
        return NextResponse.json({ error: "score must be a number between 0 and 100" }, { status: 400 });
    }
    const score = Math.round(raw);

    try {
        const dist = await getScoreDistribution();
        return NextResponse.json(
            { percentile: percentileFromDistribution(dist, score), sampleSize: dist.total },
            { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
        );
    } catch (error) {
        // 数据库不可用（如未配置 DATABASE_URL 的本地环境）：静默降级为不展示，且不写缓存
        console.error("[score-percentile] aggregate failed:", error);
        return NextResponse.json({ percentile: null, sampleSize: 0 });
    }
}
