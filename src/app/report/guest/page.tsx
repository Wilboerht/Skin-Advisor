import { Metadata } from "next";
import ShareLandingClient from "./ShareLandingClient";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getConcernLabel } from "@/lib/advisor-utils";

interface GuestReportPageProps {
    searchParams: Promise<{ id?: string }>;
}

export default async function GuestReportPage(props: GuestReportPageProps) {
    const searchParams = await props.searchParams;
    const { id } = searchParams;

    if (!id) {
        return notFound();
    }

    // Fetch ONLY safe public data (including user info for display)
    const session = await prisma.advisorSession.findUnique({
        where: { sessionId: id },
        select: {
            analysisResult: true,
            expiresAt: true,
            city: true,
            province: true,
            user: {
                select: {
                    name: true
                }
            }
        }
    });

    if (!session || !session.analysisResult) {
        return notFound();
    }

    // Check expiration (soft check, maybe allowed to see expired for sharing? strict for now)
    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
                <p>该分享链接已过期</p>
            </div>
        );
    }

    const result = session.analysisResult as any;
    const userScore = result.faceAnalysis?.overallScore || result.skinAnalysis?.score || 85;

    // --- Build Guest Simplified Analysis ---
    const fullSummary = result.analysis?.summary || result.skinAnalysis?.summary || "";

    const concerns: string[] = result.skinProfile?.concerns || result.skinAnalysis?.concerns || [];
    // Convert concern keys (e.g. "hydration") to chinese labels
    const localizedConcerns = concerns.map(c => getConcernLabel(c));

    // Extract a few recommendations/tips (max 3)
    const allTips: string[] = result.faceAnalysis?.recommendations || [];
    const briefTips = allTips.slice(0, 3);

    // If no tips from faceAnalysis, generate generic ones based on skin type
    const skinTypeKey = result.skinProfile?.type || result.skinAnalysis?.skinType || "combination";
    const genericTips: Record<string, string[]> = {
        oily: ["建议使用温和氨基酸洁面", "注意日常控油补水", "选择清爽质地的护肤品"],
        dry: ["加强保湿屏障修复", "避免过度清洁", "使用含神经酰胺的面霜"],
        combination: ["T区控油，两颊保湿", "选择平衡型护肤品", "注意分区护理"],
        sensitive: ["避免含酒精的产品", "加强屏障修复", "选择低刺激性配方"],
        normal: ["保持现有良好习惯", "注意日常防晒", "定期做深层清洁"],
    };
    const finalTips = briefTips.length > 0 ? briefTips : (genericTips[skinTypeKey] || genericTips.combination);

    const guestAnalysis = {
        summary: fullSummary,
        concerns: localizedConcerns.slice(0, 4), // max 4 concerns
        tips: finalTips,
        skinTypeKey,
        hydrationLevel: result.faceAnalysis?.hydration?.level || null,
    };

    // Extract AI-detected gender for mismatch detection on client
    const detectedGender = result.faceAnalysis?.gender
        ? { value: result.faceAnalysis.gender.value, confidence: result.faceAnalysis.gender.confidence || 0 }
        : null;

    // Construct Safe Data Payload (No PPI, no photos)
    const safeData = {
        score: userScore,
        skinType: result.skinProfile?.typeLabel || "未知肤质",
        skinAge: result.skinProfile?.skinAge || 25,
        dimensions: result.faceAnalysis?.dimensions || {}, // Needed for chart
        publishDate: new Date().toLocaleDateString(),
        // User info for display (prioritize nickname from analysisResult)
        nickname: result.nickname || session.user?.name || `用户${id.substring(0, 8)}`,
        generatedAvatar: result.generatedAvatar || null,
        city: result.userLocation?.city || session.city || session.province || "未知城市",
        isGuest: !session.user,
        // Session ID
        sessionId: id,
        // Gender mismatch detection
        detectedGender,
        // Guest simplified analysis
        guestAnalysis,
    };

    return <ShareLandingClient data={safeData} />;
}


export async function generateMetadata(props: GuestReportPageProps): Promise<Metadata> {
    const searchParams = await props.searchParams;
    const { id } = searchParams;

    // Quick fetch for metadata
    const session = await prisma.advisorSession.findUnique({
        where: { sessionId: id },
        select: { analysisResult: true }
    });

    if (!session?.analysisResult) {
        return { title: "MySkinToday Technology - 专业肤质检测" };
    }

    const result = session.analysisResult as any;
    const score = result.faceAnalysis?.overallScore || 85;
    const skinType = result.skinProfile?.typeLabel || "未知肤质";

    return {
        title: `我的肤质评分 ${score}！快来测测你的 | MySkinToday Technology`,
        description: `我刚刚完成了实验室级肤质检测，原来我是${skinType}。解锁你的专属护肤方案，点击立即免费测试。`,
    };
}
