/**
 * 回填 SkinAssessment 汇总表（幂等）。
 *
 * 用法：
 *   npx tsx scripts/backfill-skin-assessments.ts
 *   npx tsx scripts/backfill-skin-assessments.ts --dry-run
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { buildSkinAssessment } from "../src/lib/report/assessment";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = 200;

async function main() {
    let cursor: string | undefined;
    let scanned = 0;
    let written = 0;
    let skipped = 0;

    for (;;) {
        const rows = await prisma.advisorSession.findMany({
            where: {
                userId: { not: null },
                completedAt: { not: null },
                archivedAt: null,
                analysisResult: { not: Prisma.DbNull },
            },
            orderBy: { id: "asc" },
            take: BATCH,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true,
                sessionId: true,
                userId: true,
                completedAt: true,
                analysisResult: true,
            },
        });
        if (rows.length === 0) break;

        for (const row of rows) {
            scanned += 1;
            if (!row.userId || !row.completedAt) {
                skipped += 1;
                continue;
            }
            const raw = row.analysisResult as Record<string, unknown>;
            const faceAnalysis = (raw.faceAnalysis as Parameters<typeof buildSkinAssessment>[0]["faceAnalysis"]) || null;
            const assessment = buildSkinAssessment({
                sessionId: row.sessionId,
                userId: row.userId,
                completedAt: row.completedAt,
                rawResult: raw,
                faceAnalysis,
            });
            if (!assessment) {
                skipped += 1;
                continue;
            }
            if (!DRY_RUN) {
                const data = {
                    ...assessment,
                    dimensions: assessment.dimensions as unknown as Prisma.InputJsonValue,
                    zones: assessment.zones as unknown as Prisma.InputJsonValue,
                    conditions: assessment.conditions as unknown as Prisma.InputJsonValue,
                    findings: assessment.findings as unknown as Prisma.InputJsonValue,
                    lowConfidence: assessment.lowConfidence as unknown as Prisma.InputJsonValue,
                    notVisible: assessment.notVisible as unknown as Prisma.InputJsonValue,
                };
                await prisma.skinAssessment.upsert({
                    where: { sessionId: row.sessionId },
                    update: data,
                    create: data,
                });
            }
            written += 1;
        }

        cursor = rows[rows.length - 1].id;
        console.log(`[backfill] scanned=${scanned} written=${written} skipped=${skipped}`);
        if (rows.length < BATCH) break;
    }

    console.log(`[backfill] done. scanned=${scanned} written=${written} skipped=${skipped}${DRY_RUN ? " (dry-run)" : ""}`);
}

main()
    .catch((error) => {
        console.error("[backfill] failed", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
