import { Metadata } from "next";
import { cache } from "react";
import ResultClient from "../../result/ResultClient";
import { type ComprehensiveResult, type PreviousTestSummary, normalizeAnalysisResult } from "@/lib/analysis-result";
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
            completedAt: true,
            archivedAt: true,
        },
    })
);

// 本次报告之前最近一次已完成测肤的摘要：两页版式封面判定基准 + 趋势对比板块数据源。
// 归档冷层（压缩摘要）保留 persona/overallScore/skinAge，字段解析与热层兼容，故不排除归档会话——
// 归档摘要已含趋势对比所需的全部字段，排除反而会让超过保留窗口的老用户对比断档；
// 游客无 DB 上下文，走 localStorage（ResultClient 处理）。
// before = 当前报告的完成时间：只取早于它的测肤，保证打开历史报告时对比基准语义正确
const getPreviousSummary = cache(
    async (id: string, userId: string, before: Date | null): Promise<PreviousTestSummary | null> => {
        const prev = await prisma.advisorSession.findFirst({
            where: {
                userId,
                sessionId: { not: id },
                completedAt: { not: null, ...(before ? { lt: before } : {}) },
            },
            orderBy: { completedAt: "desc" },
            select: { analysisResult: true, completedAt: true },
        });
        if (!prev) return null;
        const raw = (prev.analysisResult as unknown as Record<string, unknown>) || {};
        const face = raw.faceAnalysis as Record<string, unknown> | undefined;
        // 新格式 skinProfile 优先，旧格式/归档兼容路径 skinAnalysis 兜底（与 normalizeAnalysisResult 一致）
        const skin = (raw.skinProfile ?? raw.skinAnalysis) as Record<string, unknown> | undefined;
        const summary: PreviousTestSummary = {
            persona: typeof raw.persona === "string" ? raw.persona : null,
            score: typeof face?.overallScore === "number" ? face.overallScore : null,
            skinAge: typeof skin?.skinAge === "number" ? skin.skinAge : null,
            at: prev.completedAt?.toISOString() ?? null,
        };
        // 全空即无有效对比基准（降级旧记录）：与游客端快照守卫（ResultClient 恢复 localStorage 处的判断）一致，
        // 避免渲染三格全 "—" 的无意义对比卡、结论误写"整体肌肤状态保持稳定"
        if (summary.persona == null && summary.score == null && summary.skinAge == null) return null;
        return summary;
    }
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

    let previousSummary: PreviousTestSummary | null = null;
    // 当前报告的完成时间：作为"上一次"查询的时间上界
    let currentCompletedAt: Date | null = null;

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
                // 完成时间以 DB 记录为准（历史报告来自旧数据时结果内可能无 analyzedAt）
                result.analyzedAt = session.completedAt?.toISOString() || result.analyzedAt;
                currentCompletedAt = session.completedAt;
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

    // 封面页展示基准 + 趋势对比数据源：上一次测肤摘要（首次测试为 null；查询失败降级为 null，不影响出页）
    try {
        previousSummary = await getPreviousSummary(id, user.id, currentCompletedAt);
    } catch (e) {
        logger.error(`Failed to fetch previous summary: ${String(e)}`);
        previousSummary = null;
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
            <ResultClient id={id} initialData={initialData} previousSummary={previousSummary} />
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
                // 新格式 skinProfile 优先，旧格式 skinAnalysis 兜底（与 normalizeAnalysisResult 一致）
                const skinProfile = rawResult.skinProfile as Record<string, unknown> | undefined;
                const skinAnalysis = rawResult.skinAnalysis as Record<string, unknown> | undefined;
                const score = typeof faceAnalysis?.overallScore === "number" ? faceAnalysis.overallScore : undefined;
                const skinType =
                    (skinProfile?.typeLabel as string | undefined) ||
                    (skinAnalysis?.typeLabel as string | undefined);

                if (typeof score === "number") {
                    title = skinType
                        ? `${score}分！我的${skinType}护肤报告已生成`
                        : `${score}分！我的护肤报告已生成`;
                    description = `AI 分析得分 ${score} 分${skinType ? `，肤质类型：${skinType}` : ""}。查看完整护肤方案与产品推荐。`;
                } else {
                    // 无真实面部分数（纯问卷/降级报告）时不伪造分数
                    title = "我的专属测肤报告";
                    description = skinType
                        ? `肤质类型：${skinType}。查看完整护肤方案与产品推荐。`
                        : "基于 AI 的深度肤质分析，为您定制专属护肤方案。";
                }
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
