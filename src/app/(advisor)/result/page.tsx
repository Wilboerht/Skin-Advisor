import { Metadata } from "next";
import ResultClient from "./ResultClient";
import { getSessionUser } from "@/lib/sso-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { normalizeAnalysisResult, type ComprehensiveResult } from "@/lib/analysis-result";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

export default async function ResultPage(props: {
    searchParams: Promise<{ id?: string; status?: string }>;
}) {
    const searchParams = await props.searchParams;
    const id = searchParams.id;
    const status = searchParams.status;
    const user = await getSessionUser();

    // /result 只表示「当前结果」。
    // 登录用户且 URL 带了已完成报告的 id 时，直接跳转到历史报告页 /reports/:id，
    // 避免客户端先渲染 /result 再跳转的闪烁。
    if (id && status !== 'analyzing' && user) {
        redirect(`/reports/${id}`);
    }

    let initialData: { result: ComprehensiveResult; faceAnalysis: FaceAnalysisResult | null } | null = null;

    // 服务端预加载：登录用户携带 id 且非分析中时，直接查询该会话
    if (id && status !== 'analyzing' && user) {
        try {
            const session = await prisma.advisorSession.findUnique({
                where: { sessionId: id, userId: user.id },
                select: { analysisResult: true, expiresAt: true },
            });
            if (session?.analysisResult && (!session.expiresAt || new Date() <= new Date(session.expiresAt))) {
                const rawResult = session.analysisResult as unknown as Record<string, unknown>;
                const result = normalizeAnalysisResult(rawResult);
                if (result) {
                    result.expiresAt = session.expiresAt?.toISOString();
                    initialData = {
                        result,
                        faceAnalysis: (rawResult.faceAnalysis as FaceAnalysisResult | null) || null,
                    };
                }
            }
        } catch (e) {
            console.error("Failed to preload result session:", e);
        }
    }

    return <ResultClient id={id} initialData={initialData} user={user} />;
}

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "我的专业护肤报告",
        description: "基于 AI 的深度肤质分析，精准检测肤质类型，为您定制专属护肤方案与产品推荐。",
        robots: { index: false, follow: false },
    };
}
