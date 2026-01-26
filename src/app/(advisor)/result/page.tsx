
import { Metadata } from "next";
import ResultClient from "./ResultClient";
import prisma from "@/lib/prisma";

export default async function ResultPage(props: {
    searchParams: Promise<{ id?: string }>;
}) {
    const searchParams = await props.searchParams;
    const id = searchParams.id;
    let initialData = null;

    if (id) {
        try {
            const session = await prisma.advisorSession.findUnique({
                where: { sessionId: id },
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
                    console.log(`Session ${id} expired at ${session.expiresAt}`);
                    // Return null or specific expired state
                    // Ideally we could redirect or show an expired state component
                    // For now, let's treat it as not found so it falls back appropriately
                    initialData = null;
                } else {
                    const result = session.analysisResult as any;
                    initialData = {
                        result: result as any,
                        faceAnalysis: result.faceAnalysis || null
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
    let title = "我的专业护肤报告 | MySkin Advisor";
    let description = "基于 AI 的深度肤质分析，为您定制专属护肤方案。";
    let ogImage = "/images/share-default.jpg"; // Fallback

    if (id) {
        try {
            const session = await prisma.advisorSession.findUnique({
                where: { sessionId: id },
                select: { analysisResult: true }
            });

            if (session && session.analysisResult) {
                const result = session.analysisResult as any;
                const score = result.faceAnalysis?.overallScore || result.skinAnalysis?.score || 85;
                const skinType = result.skinAnalysis?.typeLabel || result.skinProfile?.typeLabel || "未知肤质"; // check structure
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
