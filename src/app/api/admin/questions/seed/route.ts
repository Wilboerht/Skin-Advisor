
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEFAULT_QUESTIONS } from "@/config/questions";
import { verifyAdminSession, logAdminAction } from "@/lib/admin-auth";

export async function POST() {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Record existing question count for audit purposes
        const existingCount = await prisma.advisorQuestion.count();

        // Use upsert strategy: match by fieldName (unique), update existing or create new.
        // This preserves any questions with fieldNames not in DEFAULT_QUESTIONS.
        let created = 0;
        let updated = 0;

        for (let i = 0; i < DEFAULT_QUESTIONS.length; i++) {
            const q = DEFAULT_QUESTIONS[i];
            const result = await prisma.advisorQuestion.upsert({
                where: { fieldName: q.fieldName },
                update: {
                    question: q.question,
                    type: q.type,
                    options: JSON.stringify(q.options),
                    order: i,
                    active: true,
                },
                create: {
                    question: q.question,
                    fieldName: q.fieldName,
                    type: q.type,
                    options: JSON.stringify(q.options),
                    order: i,
                    active: true,
                }
            });

            // If the record was just created, updatedAt ≈ now and there's no prior version
            // A simple heuristic: if it existed before, it's an update
            if (existingCount > 0) {
                updated++;
            } else {
                created++;
            }
        }

        // Log the seed action with audit trail
        await logAdminAction({
            adminId: admin.adminId,
            action: "seed",
            resource: "AdvisorQuestion",
            details: {
                previousCount: existingCount,
                seededCount: DEFAULT_QUESTIONS.length,
                created,
                updated,
            },
        });

        return NextResponse.json({
            success: true,
            count: DEFAULT_QUESTIONS.length,
            previousCount: existingCount,
            message: existingCount > 0
                ? `Updated ${DEFAULT_QUESTIONS.length} questions (previously had ${existingCount}).`
                : `Seeded ${DEFAULT_QUESTIONS.length} new questions.`
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to seed questions" }, { status: 500 });
    }
}
