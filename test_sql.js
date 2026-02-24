const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const topScoresRows = await prisma.$queryRaw`
            SELECT 
                s."sessionId", 
                COALESCE(
                    CAST(s."analysisResult"->'faceAnalysis'->>'overallScore' AS FLOAT),
                    CAST(s."analysisResult"->'skinAnalysis'->>'score' AS FLOAT),
                    0
                ) as calculated_score
            FROM "AdvisorSession" s
            WHERE s."analysisResult" IS NOT NULL
                AND s."createdAt" >= NOW() - INTERVAL '30 days'
            ORDER BY calculated_score DESC NULLS LAST
            LIMIT 5
        `;
        console.log("Top Scores:", topScoresRows);

        const topPopRows = await prisma.$queryRaw`
            SELECT 
                s."sessionId", 
                (
                    100 +
                    CASE WHEN (s."analysisResult"->>'nickname' IS NOT NULL OR s."userId" IS NOT NULL) THEN 50 ELSE 0 END +
                    CASE WHEN (s."analysisResult"->'userLocation'->>'city' IS NOT NULL OR s."city" IS NOT NULL OR s."province" IS NOT NULL) THEN 50 ELSE 0 END +
                    CASE WHEN s."resultShared" = true THEN 3000 ELSE 0 END +
                    GREATEST(0, ROUND(CAST(500 * (1 - EXTRACT(EPOCH FROM (NOW() - s."createdAt")) / (30 * 24 * 3600)) AS NUMERIC)))
                ) as calculated_popularity
            FROM "AdvisorSession" s
            WHERE s."analysisResult" IS NOT NULL
                AND s."createdAt" >= NOW() - INTERVAL '30 days'
            ORDER BY calculated_popularity DESC NULLS LAST
            LIMIT 5
        `;
        console.log("Top Pop:", topPopRows);

    } catch (e) {
        console.error("SQL Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
