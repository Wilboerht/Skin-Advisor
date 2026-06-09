
import { Metadata } from "next";
import ResultClient, { type ComprehensiveResult } from "./ResultClient";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

export default async function ResultPage(props: {
    searchParams: Promise<{ id?: string; status?: string }>;
}) {
    const searchParams = await props.searchParams;
    const id = searchParams.id;
    const status = searchParams.status;
    let initialData = null;

    // Fetch session early for ownership checks
    const user = await getSession();

    // --- Server-Side Guest Protection ---
    // Check if user is logged in BEFORE fetching any sensitive data.
    // If guest has an id (trying to access a specific report), redirect to share page.
    // Exception: status=analyzing means analysis is in progress (no data yet),
    // the client-side will handle the redirect after analysis completes.
    if (id && status !== 'analyzing') {
        if (!user) {
            // Guest trying to access full report → redirect to simplified share page
            redirect(`/report/guest?id=${id}`);
        }
    }

    if (id) {
        try {
            const session = await prisma.advisorSession.findUnique({
                where: { sessionId: id, userId: user?.id || undefined },
                select: {
                    answers: true,
                    analysisResult: true,
                    faceScanUsed: true,
                    expiresAt: true
                }
            });

            if (session && session.analysisResult) {
                // Check Expiration
                if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
                    initialData = null;
                } else {
                    const rawResult = session.analysisResult as unknown as Record<string, unknown>;
                    const result = rawResult as unknown as ComprehensiveResult;
                    initialData = {
                        result,
                        faceAnalysis: rawResult.faceAnalysis as FaceAnalysisResult | null || null,
                        generatedAvatar: rawResult.generatedAvatar as string | null || null
                    };
                }
            }
        } catch (e) {
            console.error("Failed to fetch session:", e);
        }
    }

    if (id && !initialData) {
        // Optional: You could render a specific "Report Expired" component here
        // return <div className="p-10 text-center">报告已过期或不存在</div>;
    }

    return <ResultClient id={id} initialData={initialData} />;
}

export async function generateMetadata(props: {
    searchParams: Promise<{ id?: string }>;
}): Promise<Metadata> {
    const searchParams = await props.searchParams;
    const id = searchParams.id;
    let title = "我的专业护肤报告 | MySkinToday Technology";
    const description = "基于 AI 的深度肤质分析，为您定制专属护肤方案。";
    let ogImage = "/images/share-default.jpg"; // Fallback

    // 只有登录用户才能获取详细 OG 元数据，防止信息泄露
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
                const skinType = (skinAnalysis?.typeLabel as string | undefined) || result.skinProfile?.typeLabel || "未知肤质"; // check structure
                // skinProfile.typeLabel seems to be the one in ComprehensiveResult interface

                const params = new URLSearchParams();
                params.set("id", id);
                params.set("score", score.toString());
                params.set("skinType", skinType);
                params.set("date", new Date().toISOString().split('T')[0]);

                // Use absolute URL for OG image if possible, but relative often works in Next.js metadata if base is set.
                // Better to set metadataBase in layout.
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
