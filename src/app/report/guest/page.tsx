import { Metadata } from "next";
import ShareLandingClient from "./ShareLandingClient";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

interface GuestReportPageProps {
    searchParams: Promise<{ id?: string }>;
}

export default async function GuestReportPage(props: GuestReportPageProps) {
    const searchParams = await props.searchParams;
    const { id } = searchParams;

    if (!id) {
        redirect("/");
    }

    const session = await prisma.advisorSession.findUnique({
        where: { sessionId: id },
        select: {
            analysisResult: true,
            expiresAt: true,
            user: {
                select: {
                    name: true
                }
            }
        }
    });

    if (!session || !session.analysisResult) {
        redirect("/");
    }

    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
        redirect("/");
    }

    // 显式 pick 需要的字段传给客户端，避免直接透传整个数据库原始对象
    const raw = session.analysisResult as Record<string, unknown>;
    const analysisResult: Record<string, unknown> = { ...raw };
    // 兜底：如果 analysisResult 里没有 nickname，用 session 关联的用户名
    if (!analysisResult.nickname && session.user?.name) {
        analysisResult.nickname = session.user.name;
    }

    return <ShareLandingClient analysisResult={analysisResult} sessionId={id} />;
}


export async function generateMetadata(props: GuestReportPageProps): Promise<Metadata> {
    const searchParams = await props.searchParams;
    const { id } = searchParams;

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
