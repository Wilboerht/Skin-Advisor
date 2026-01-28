import prisma from "@/lib/prisma";
import QuestionListClient from "@/components/admin/QuestionListClient";

export const dynamic = 'force-dynamic';

export default async function QuestionsPage() {
    const questions = await prisma.advisorQuestion.findMany({
        orderBy: { order: "asc" },
    });

    return (
        <div className="animate-in fade-in duration-500">
            <QuestionListClient initialQuestions={questions} />
        </div>
    );
}
