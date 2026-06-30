import { Metadata } from "next";
import ResultClient, { type ComprehensiveResult } from "../../result/ResultClient";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

export default async function ReportDetailPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const id = params.id;
    let initialData = null;

    const user = await getSession();

    // 历史报告必须登录查看
    if (!user) {
        redirect(`/?auth=login&redirect=${encodeURIComponent(`/reports/${id}`)}`);
    }

    if (id) {
        try {
            const session = await prisma.advisorSession.findUnique({
                where: { sessionId: id, userId: user.id },
                select: {
                    answers: true,
                    analysisResult: true,
                    faceScanUsed: true,
                    expiresAt: true
                }
            });

            if (session && session.analysisResult) {
                if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
                    initialData = null;
                } else {
                    const rawResult = session.analysisResult as unknown as Record<string, unknown>;
                    const result = rawResult as unknown as ComprehensiveResult;
                    initialData = {
                        result,
                        faceAnalysis: rawResult.faceAnalysis as FaceAnalysisResult | null || null
                    };
                }
            }
        } catch (e) {
            console.error("Failed to fetch report:", e);
        }
    }

    return <ResultClient id={id} initialData={initialData} />;
}

export async function generateMetadata(props: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const params = await props.params;
    const id = params.id;
    let title = "我的专业护肤报告 | MySkinToday Technology";
    const description = "基于 AI 的深度肤质分析，为您定制专属护肤方案。";
    let ogImage = "/images/share-default.jpg";

    const user = await getSession();
    if (id && user) {
        try {
            const session = await prisma.advisorSession.findUnique({
                where: { sessionId: id, userId: user.id },
                select: { analysisResult: true }
            });

            if (session && session.analysisResult) {
                const rawResult = session.analysisResult as unknown as Record<string, unknown>;
                const result = rawResult as unknown as ComprehensiveResult;
                const faceAnalysis = rawResult.faceAnalysis as Record<string, unknown> | undefined;
                const skinAnalysis = rawResult.skinAnalysis as Record<string, unknown> | undefined;
                const score = (faceAnalysis?.overallScore as number | undefined) || (skinAnalysis?.score as number | undefined) || 85;
                const skinType = (skinAnalysis?.typeLabel as string | undefined) || result.skinProfile?.typeLabel || "未知肤质";

                const params = new URLSearchParams();
                params.set("id", id);
                params.set("score", score.toString());
                params.set("skinType", skinType);
                params.set("date", new Date().toISOString().split('T')[0]);

                ogImage = `/api/advisor/share-image?${params.toString()}`;
                title = `${score}分！我的${skinType}护肤报告已生成`;
            }
        } catch (e) {
            console.error(e);
        }
    }

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [
                {
                    url: ogImage,
                    width: 1200,
                    height: 630,
                    alt: "Skin Analysis Report",
                },
            ],
        },
    };
}
