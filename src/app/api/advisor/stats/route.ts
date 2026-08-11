import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ISR: 5 分钟缓存，降低数据库负载
export const revalidate = 300;

/** 肤色类型 → 派系名映射（与 matchCharacterIP 保持一致） */
const SKINTYPE_TO_PERSONA: Record<string, string> = {
  sensitive: "敏敏派",
  dry: "沙漠派",
  oily: "油条派",
  combination: "混合派",
  combination_dry: "混合派",
  combination_oily: "混合派",
  normal: "极简派",
  unknown: "守护派",
};

interface PersonaStat {
  persona: string;
  count: number;
}

interface SessionSummary {
  sessionId: string;
  skinType: string | null;
  completedAt: string;
  overallScore: number | null;
}

/**
 * GET /api/advisor/stats
 *
 * 公开统计 API：返回累计完成测肤用户数 + 派系分布 + 最近加入动态。
 * 不含任何敏感用户数据，用于首页社交 proof 展示。
 */
export async function GET() {
  try {
    // 1. 累计完成测肤数
    const totalCompleted = await prisma.advisorSession.count({
      where: { completedAt: { not: null } },
    });

    // 2. 派系分布 — 从 analysisResult JSON 提取 skinType 聚合
    let personaDistribution: PersonaStat[] = [];
    try {
      const rawDistribution = await prisma.$queryRawUnsafe<Array<{ skin_type: string; count: bigint }>>(
        `SELECT
          "analysisResult"->'skinProfile'->>'type' as skin_type,
          COUNT(*)::int as count
        FROM "AdvisorSession"
        WHERE "completedAt" IS NOT NULL
          AND "analysisResult" IS NOT NULL
        GROUP BY skin_type
        ORDER BY count DESC
        LIMIT 20`
      );

      // 聚合 skinType → persona
      const personaMap = new Map<string, number>();
      for (const row of rawDistribution) {
        const st = (row.skin_type || "").toLowerCase();
        const persona = SKINTYPE_TO_PERSONA[st] || "守护派";
        personaMap.set(persona, (personaMap.get(persona) || 0) + Number(row.count));
      }

      // 按热度排序
      personaDistribution = Array.from(personaMap.entries())
        .map(([persona, count]) => ({ persona, count }))
        .sort((a, b) => b.count - a.count);
    } catch {
      // JSON 字段提取可能因数据库版本不兼容而失败，降级返回空
      console.warn("[stats] Failed to extract persona distribution, returning empty");
    }

    // 3. 最近完成的测肤（用于"最新加入的XX派"动态）
    let recentSessions: SessionSummary[] = [];
    try {
      const rawRecent = await prisma.advisorSession.findMany({
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 20,
        select: {
          sessionId: true,
          completedAt: true,
          analysisResult: true,
        },
      });

      recentSessions = rawRecent.map((s) => {
        const result = s.analysisResult as Record<string, unknown> | null;
        const skinProfile = (result?.skinProfile as Record<string, unknown>) || {};
        const skinType = (skinProfile.type as string) || null;
        const overallScore =
          result && typeof result === "object" && "overallScore" in result
            ? (result as { overallScore: number }).overallScore
            : null;
        return {
          sessionId: s.sessionId,
          skinType,
          completedAt: s.completedAt!.toISOString(),
          overallScore,
        };
      });
    } catch {
      console.warn("[stats] Failed to fetch recent sessions");
    }

    return NextResponse.json(
      {
        totalCompleted,
        personaDistribution,
        recentSessions,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.warn("[stats] DB unavailable, returning empty:", (error as Error).message);
    return NextResponse.json(
      { totalCompleted: 0, personaDistribution: [], recentSessions: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
