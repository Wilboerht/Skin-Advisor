import type { Metadata } from "next";
import {
    ADMIN_FUNNEL_DAYS,
    getAdminFunnelCounts,
} from "@/lib/admin-funnel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "转化漏斗",
    description: "测肤转化漏斗（近 30 天）",
    robots: { index: false, follow: false },
};

interface FunnelStep {
    key: string;
    label: string;
    count: number;
}

export default async function AdminFunnelPage() {
    const {
        total,
        questionnaireStarted,
        questionnaireCompleted,
        captureStarted,
        captureCompleted,
        faceAnalyzed,
        reportStarted,
        reportCompleted,
        resultViewed,
    } = await getAdminFunnelCounts();

    const steps: FunnelStep[] = [
        { key: "questionnaire_started", label: "进入问卷", count: questionnaireStarted },
        { key: "questionnaire_completed", label: "完成问卷", count: questionnaireCompleted },
        { key: "capture_started", label: "开始扫脸", count: captureStarted },
        { key: "capture_completed", label: "完成扫脸拍摄", count: captureCompleted },
        { key: "face_analyzed", label: "面部 AI 完成", count: faceAnalyzed },
        { key: "report_started", label: "开始生成报告", count: reportStarted },
        { key: "report_completed", label: "报告完成", count: reportCompleted },
        { key: "result_viewed", label: "查看报告", count: resultViewed },
    ];

    const base = Math.max(1, steps[0]?.count ?? 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-brand-charcoal">转化漏斗</h1>
                <p className="mt-1 text-sm text-brand-charcoal/60">
                    近 {ADMIN_FUNNEL_DAYS} 天 · 扫脸事件与分析会话已归并到同一 sessionId · 共{" "}
                    {total.toLocaleString("zh-CN")} 个会话
                </p>
            </div>

            <div className="rounded-2xl border border-brand-charcoal/10 bg-white p-4 sm:p-6">
                <div className="space-y-4">
                    {steps.map((step, index) => {
                        const prev = index > 0 ? steps[index - 1] : null;
                        const fromStart = step.count / base;
                        const fromPrev = prev && prev.count > 0 ? step.count / prev.count : null;
                        return (
                            <div key={step.key}>
                                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="w-5 text-right text-[11px] tabular-nums text-brand-charcoal/35">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <span className="text-sm font-medium text-brand-charcoal">{step.label}</span>
                                    </div>
                                    <div className="flex items-baseline gap-3 text-xs">
                                        <span className="font-semibold tabular-nums text-brand-charcoal">
                                            {step.count.toLocaleString("zh-CN")}
                                        </span>
                                        <span className="w-14 text-right tabular-nums text-brand-charcoal/45">
                                            {fromStart > 0 ? `${(fromStart * 100).toFixed(1)}%` : "0%"}
                                        </span>
                                        {fromPrev !== null && (
                                            <span className={`w-16 text-right tabular-nums ${fromPrev >= 0.5 ? "text-emerald-600" : "text-rose-500"}`}>
                                                {fromPrev >= 0 ? "+" : ""}{(fromPrev * 100).toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="ml-7 h-2.5 overflow-hidden rounded-full bg-brand-charcoal/[0.06]">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-brand-primary/70 to-brand-primary"
                                        style={{ width: `${Math.max(step.count > 0 ? 1.5 : 0, fromStart * 100)}%` }}
                                    />
                                </div>
                                {index === 3 && (
                                    <p className="ml-7 mt-1.5 text-[11px] leading-relaxed text-brand-charcoal/45">
                                        “完成扫脸拍摄”来自埋点交互；“面部 AI 完成”来自服务端 face-analyze 持久化。两步分开可定位拍摄失败还是视觉 AI 失败。
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-[12px] leading-relaxed text-amber-800">
                口径说明：进入问卷/完成问卷来自问卷字段；开始扫脸与完成拍摄来自 interactions；面部 AI 完成来自 faceScanCompletedAt；
                开始生成/报告完成来自 analysisStartedAt/completedAt；查看报告来自 resultViewedAt。
            </div>
        </div>
    );
}
