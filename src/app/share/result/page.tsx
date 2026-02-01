import { Metadata } from "next";
import ShareLandingClient from "./ShareLandingClient";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

interface SharePageProps {
    searchParams: Promise<{ id?: string }>;
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

    // Construct Safe Data Payload (No PPI, no photos)
    const safeData = {
        score: result.faceAnalysis?.overallScore || result.skinAnalysis?.score || 85,
        skinType: result.skinProfile?.typeLabel || "未知肤质",
        skinAge: result.skinProfile?.skinAge || 25,
        dimensions: result.faceAnalysis?.dimensions || {}, // Needed for chart
        publishDate: new Date().toLocaleDateString(),
        // User info for display (prioritize nickname from analysisResult)
        nickname: result.nickname || session.user?.name || generateRandomNickname(),
        city: result.userLocation?.city || session.city || session.province || "未知城市",
        isGuest: !session.user
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
