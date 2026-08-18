import { Metadata } from "next";
import { cache } from "react";
import ResultClient from "../../result/ResultClient";
import { type ComprehensiveResult, normalizeAnalysisResult } from "@/lib/analysis-result";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getSessionUser } from "@/lib/sso-auth";
import { notFound, redirect } from "next/navigation";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

// getSession 已在 auth.ts 中通过 React cache() 包装，请求内自动去重
const getReportCached = cache((id: string, userId: string) =>
    prisma.advisorSession.findUnique({
        where: { sessionId: id, userId },
        select: {
            answers: true,
            analysisResult: true,
            faceScanUsed: true,
            expiresAt: true,
            archivedAt: true,
        },
    })
);

export default async function ReportDetailPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const id = params.id;
    let initialData: {
        result: ComprehensiveResult;
        faceAnalysis: FaceAnalysisResult | null;
        answers: Record<string, unknown> | null;
    } | null = null;
    let isExpired = false;
    let isArchived = false;

    const user = await getSessionUser();

    if (!user) {
        redirect(`/?auth=login&redirect=${encodeURIComponent(`/reports/${id}`)}`);
    }

    if (id) {
        try {
            const session = await getReportCached(id, user.id);

            if (!session || !session.analysisResult) {
                notFound();
            }

            // 冷层归档报告（每用户仅最近 10 条保留完整数据）对用户不可见
            if (session.archivedAt) {
                isArchived = true;
            } else {
                // 过期报告仍作为历史档案可查看（滚动续期策略），页面顶部提示复测
                if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
                    isExpired = true;
                }
                const rawResult = session.analysisResult as unknown as Record<string, unknown>;
                const result = normalizeAnalysisResult(rawResult);
                if (!result) {
                    notFound();
                }
                result.expiresAt = session.expiresAt?.toISOString();
                initialData = {
                    result,
                    faceAnalysis: (rawResult.faceAnalysis as FaceAnalysisResult | null) || null,
                    // 该次测肤的问卷答案，供报告摘要（复制给护肤顾问）使用
                    answers: (session.answers as Record<string, unknown> | null) || null,
                };
            }
        } catch (e) {
            logger.error(`Failed to fetch report: ${String(e)}`);
            notFound();
        }
    }

    if (isArchived) {
        return <ReportArchived />;
    }

    if (!initialData) {
        notFound();
    }

    return (
        <>
            {isExpired && <ReportExpiredBanner />}
            <ResultClient id={id} initialData={initialData} />
        </>
    );
}

function ReportArchived() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-4">
            <div className="text-center max-w-md">
                <div className="text-5xl mb-4">🗂️</div>
                <h2 className="text-xl font-bold text-[#5c4937] mb-2">报告已归档</h2>
                <p className="text-sm text-[#8c7a6b] mb-6">
                    历史报告仅保留最近 10 份的完整内容，更早的报告已归档为统计数据。您的肤质趋势对比不受影响。
                </p>
                <a
                    href="/questions"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#5c4937] px-6 py-3 text-sm font-medium text-white shadow-lg transition-transform active:scale-95"
                >
                    重新测试
                </a>
            </div>
        </div>
    );
}

function ReportExpiredBanner() {
    return (
        <div className="w-full bg-[#f5ead9] px-4 py-3">
            <div className="mx-auto flex max-w-[900px] flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
                <p className="text-sm text-[#8c6d3f]">
                    该报告已超过 90 天有效期，皮肤状态可能已变化。为保持肌肤档案准确，建议重新测试更新档案。
                </p>
                <a
                    href="/questions"
                    className="inline-flex items-center justify-center rounded-full bg-[#5c4937] px-4 py-1.5 text-xs font-medium text-white transition-transform active:scale-95"
                >
                    重新测试
                </a>
            </div>
        </div>
    );
}

export async function generateMetadata(props: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const params = await props.params;
    const id = params.id;
    let title = "我的专业护肤报告";
    let description = "基于 AI 的深度肤质分析，为您定制专属护肤方案。";
    const ogImage = "/images/og-default.png";

    const user = await getSessionUser();
    if (id && user) {
        try {
            const session = await getReportCached(id, user.id);

            if (session && session.archivedAt) {
                title = "报告已归档";
                description = "该历史报告已归档为统计数据，请查看最新报告。";
            } else if (session && session.analysisResult) {
                const rawResult = session.analysisResult as unknown as Record<string, unknown>;
                const faceAnalysis = rawResult.faceAnalysis as Record<string, unknown> | undefined;
                const skinAnalysis = rawResult.skinAnalysis as Record<string, unknown> | undefined;
                const score = (faceAnalysis?.overallScore as number | undefined) || (skinAnalysis?.score as number | undefined) || 85;
                const skinType = (skinAnalysis?.typeLabel as string | undefined) || "未知肤质";

                title = `${score}分！我的${skinType}护肤报告已生成`;
                description = `AI 分析得分 ${score} 分，肤质类型：${skinType}。查看完整护肤方案与产品推荐。`;
            }
        } catch (e) {
            logger.error(String(e));
        }
    }

    return {
        title,
        description,
        robots: { index: false, follow: false },
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
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [ogImage],
        },
    };
}
