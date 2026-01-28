
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEFAULT_QUESTIONS } from "@/config/questions";

export async function POST() {
    try {
        // Clear existing questions? Or just upsert?
        // Strategy: Wipe and re-seed for simplicity during dev/beta
        await prisma.advisorQuestion.deleteMany({});

        // Insert Default Questions
        for (let i = 0; i < DEFAULT_QUESTIONS.length; i++) {
            const q = DEFAULT_QUESTIONS[i];
            await prisma.advisorQuestion.create({
                data: {
                    question: q.question,
                    fieldName: q.fieldName,
                    type: q.type,
                    options: JSON.stringify(q.options), // Store as JSON string or Prisma Json type
                    order: i,
                    active: true,
                    // If dependsOn exists, we might want to store it too, 
                    // but schema needs support or store in options/extra field
                    // For now, let's just seed basic
                }
            });
        }

        return NextResponse.json({ success: true, count: DEFAULT_QUESTIONS.length });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to seed questions" }, { status: 500 });
    }
}
