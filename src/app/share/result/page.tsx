import { Metadata } from "next";
import ShareLandingClient from "./ShareLandingClient";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";

interface SharePageProps {
    searchParams: Promise<{ id?: string }>;
}

// Calculate user's rank by calling the leaderboard API logic internally
// This ensures the share page and the leaderboard page use the exact same ranking
async function calculateUserRank(sessionId: string, _userScore: number) {
    try {
        // Use the same base URL for internal API call
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/advisor/leaderboard?limit=50&sessionId=${sessionId}`, {
            cache: "no-store"
        });

        if (res.ok) {
            const data = await res.json();
            if (data.userRank) {
                return {
                    rank: data.userRank.rank,
                    percentile: data.userRank.percentile,
                    totalParticipants: data.totalParticipants
                };
            }
        }
    } catch (error) {
        console.error("Failed to fetch rank from leaderboard API:", error);
    }

    // Fallback: get total count and estimate based on score
    const totalCount = await prisma.advisorSession.count({
        where: {
            analysisResult: {
                not: Prisma.JsonNull
            },
            createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
        }
    });

    // Clamp score to reasonable percentile range (60-95)
    const clampedPercentile = Math.min(95, Math.max(60, Math.round(_userScore)));
    const estimatedRank = Math.max(1, Math.round(totalCount * (100 - clampedPercentile) / 100));

    return {
        rank: estimatedRank,
        percentile: clampedPercentile,
        totalParticipants: totalCount
    };
}

export default async function SharePage(props: SharePageProps) {
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

    // Calculate user's actual rank
    const rankInfo = await calculateUserRank(id, userScore);

    // --- Build Guest Simplified Analysis ---
    const fullSummary = result.analysis?.summary || result.skinAnalysis?.summary || "";
    // Truncate summary to ~80 chars for guest teaser
    const truncatedSummary = fullSummary.length > 80
        ? fullSummary.substring(0, 80) + "..."
        : fullSummary;

    const concerns: string[] = result.skinProfile?.concerns || result.skinAnalysis?.concerns || [];

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
        summary: truncatedSummary,
        concerns: concerns.slice(0, 4), // max 4 concerns
        tips: finalTips,
        skinTypeKey,
        hydrationLevel: result.faceAnalysis?.hydration?.level || null,
    };

    // Construct Safe Data Payload (No PPI, no photos)
    const safeData = {
        score: userScore,
        skinType: result.skinProfile?.typeLabel || "未知肤质",
        skinAge: result.skinProfile?.skinAge || 25,
        dimensions: result.faceAnalysis?.dimensions || {}, // Needed for chart
        publishDate: new Date().toLocaleDateString(),
        // User info for display (prioritize nickname from analysisResult)
        nickname: result.nickname || session.user?.name || generateRandomNickname(),
        generatedAvatar: result.generatedAvatar || null,
        city: result.userLocation?.city || session.city || session.province || "未知城市",
        isGuest: !session.user,
        // Add rank info
        sessionId: id,
        userRank: rankInfo.rank,
        userPercentile: rankInfo.percentile,
        totalParticipants: rankInfo.totalParticipants,
        // Guest simplified analysis
        guestAnalysis,
    };

    return <ShareLandingClient data={safeData} />;
}

// Generate random fun nickname for guests
function generateRandomNickname(): string {
    const adjectives = ["可爱的", "阳光", "元气", "甜美", "活力", "清新", "温柔", "俏皮"];
    const nouns = ["小可爱", "宝贝", "达人", "精灵", "女神", "仙子", "小天使", "小公主"];
    return adjectives[Math.floor(Math.random() * adjectives.length)] + nouns[Math.floor(Math.random() * nouns.length)];
}

export async function generateMetadata(props: SharePageProps): Promise<Metadata> {
    const searchParams = await props.searchParams;
    const { id } = searchParams;

    // Quick fetch for metadata
    const session = await prisma.advisorSession.findUnique({
        where: { sessionId: id },
        select: { analysisResult: true }
    });

    if (!session?.analysisResult) {
        return { title: "MySkin Advisor - 专业肤质检测" };
    }

    const result = session.analysisResult as any;
    const score = result.faceAnalysis?.overallScore || 85;
    const skinType = result.skinProfile?.typeLabel || "未知肤质";

    return {
        title: `我的肤质评分 ${score}！快来测测你的 | MySkin Advisor`,
        description: `我刚刚完成了实验室级肤质检测，原来我是${skinType}。解锁你的专属护肤方案，点击立即免费测试。`,
    };
}
