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
            // 构建 fieldName -> 静态问题 的映射，用于补充 DB 中缺少的字段
            const staticMap = new Map(DEFAULT_QUESTIONS.map(q => [q.fieldName, q]));

            // 转换数据库格式为前端格式
            const questions = dbQuestions.map((q: typeof dbQuestions[number]) => {
                const staticQ = staticMap.get(q.fieldName);

                // options 在 Prisma Json 类型中已经是对象，但如果是字符串则需要解析
                let parsedOptions = q.options;
                if (typeof parsedOptions === "string") {
                    try { parsedOptions = JSON.parse(parsedOptions); } catch { /* keep as-is */ }
                }

                return {
                    id: q.id,
                    fieldName: q.fieldName,
                    question: q.question,
                    type: q.type,
                    options: parsedOptions,
                    // 从静态配置补充 DB 中未存储的字段
                    ...(staticQ?.subtext ? { subtext: staticQ.subtext } : {}),
                    ...(staticQ?.dependsOn ? { dependsOn: staticQ.dependsOn } : {}),
                };
            });
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
