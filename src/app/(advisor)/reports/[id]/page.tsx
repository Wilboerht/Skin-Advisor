import { Metadata } from "next";
import ResultClient, { type ComprehensiveResult, normalizeAnalysisResult } from "../../result/ResultClient";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

export default async function ReportDetailPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const id = params.id;
    let initialData: { result: ComprehensiveResult; faceAnalysis: FaceAnalysisResult | null } | null = null;
    let isExpired = false;

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
                    isExpired = true;
                } else {
                    const rawResult = session.analysisResult as unknown as Record<string, unknown>;
                    // 统一走 normalizeAnalysisResult 兼容新旧字段格式
                    const result = normalizeAnalysisResult(rawResult);
                    if (result) {
                        result.expiresAt = session.expiresAt?.toISOString();
                        initialData = {
                            result,
                            faceAnalysis: (rawResult.faceAnalysis as FaceAnalysisResult | null) || null
                        };
                    }
                }
            }
        } catch (e) {
            console.error("Failed to fetch report:", e);
        }
    }

    // 报告过期时直接展示过期提示，不渲染 ResultClient
    if (isExpired) {
        return <ReportExpired />;
    }

    return <ResultClient id={id} initialData={initialData} />;
}

/** 报告过期提示组件 */
function ReportExpired() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-4">
            <div className="text-center max-w-md">
                <div className="text-5xl mb-4">⏰</div>
                <h2 className="text-xl font-bold text-[#5c4937] mb-2">报告已过期</h2>
                <p className="text-sm text-[#8c7a6b] mb-6">
                    该分析报告已超过保存期限，数据已自动清除。请重新进行肤质测试获取最新报告。
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

export async function generateMetadata(props: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const params = await props.params;
    const id = params.id;
    let title = "我的专业护肤报告";
    let description = "基于 AI 的深度肤质分析，为您定制专属护肤方案。";
    let ogImage = "/images/share-default.png";

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

                const imgParams = new URLSearchParams();
                imgParams.set("id", id);
                imgParams.set("score", score.toString());
                imgParams.set("skinType", skinType);
                imgParams.set("date", new Date().toISOString().split('T')[0]);

                ogImage = `/api/advisor/share-image?${imgParams.toString()}`;
                title = `${score}分！我的${skinType}护肤报告已生成`;
                description = `AI 分析得分 ${score} 分，肤质类型：${skinType}。查看完整护肤方案与产品推荐。`;
            }
        } catch (e) {
            console.error(e);
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
