import { NextResponse } from "next/server";
import { DEFAULT_QUESTIONS } from "@/config/questions";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        // 优先从数据库加载配置的问题
        const dbQuestions = await prisma.advisorQuestion.findMany({
            where: { active: true },
            orderBy: { order: "asc" },
        });

        if (dbQuestions.length > 0) {
            // 转换数据库格式为前端格式
            const questions = dbQuestions.map((q: typeof dbQuestions[number]) => ({
                id: q.id,
                fieldName: q.fieldName,
                question: q.question,
                type: q.type,
                options: q.options,
                // 其他字段...
            }));
            return NextResponse.json(questions);
        }

        // 降级使用静态配置
        return NextResponse.json(DEFAULT_QUESTIONS);
    } catch (error) {
        console.error("Failed to fetch questions:", error);
        // 出错时返回默认静态配置
        return NextResponse.json(DEFAULT_QUESTIONS);
    }
}
