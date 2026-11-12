"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";

interface ReportFeedbackProps {
    sessionId?: string;
}

type Verdict = "accurate" | "inaccurate";

/**
 * 报告纠错（报告级）：记录用户对整份报告准确度的判断。
 * 维度/问题级反馈在后续版本扩展。
 */
export function ReportFeedback({ sessionId }: ReportFeedbackProps) {
    const toast = useToast();
    const { trackEvent } = useAdvisorAnalytics();
    const [pending, setPending] = useState<Verdict | null>(null);
    const [submitted, setSubmitted] = useState<Verdict | null>(null);

    if (!sessionId) return null;

    const submit = async (verdict: Verdict) => {
        if (pending || submitted) return;
        setPending(verdict);
        try {
            const res = await fetchWithCsrf(`/api/advisor/reports/${encodeURIComponent(sessionId)}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetType: "report", targetKey: "report", verdict }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error || "反馈失败，请稍后重试");
            }
            setSubmitted(verdict);
            trackEvent("feedback_submit", { targetType: "report", verdict });
            toast.success("感谢反馈");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "反馈失败，请稍后重试");
        } finally {
            setPending(null);
        }
    };

    return (
        <section aria-labelledby="report-feedback-title" className="rounded-2xl border border-[var(--color-brand-espresso)]/12 bg-white/55 px-4 py-3 lg:px-5 lg:py-4">
            <h4 id="report-feedback-title" className="text-sm font-medium text-[var(--color-brand-espresso)]">
                报告纠错
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-brand-taupe)]">
                这份报告符合你的实际情况吗？你的反馈会帮助我们改进分析。
            </p>
            {submitted ? (
                <p className="mt-2 text-[12px] text-[var(--color-report-success)]">已收到你的反馈，感谢。</p>
            ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => submit("accurate")}
                        className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--color-brand-espresso)]/15 bg-white px-3 text-[12px] text-[var(--color-brand-cocoa)] transition-colors hover:border-[var(--color-report-success)]/40 hover:text-[var(--color-report-success)] disabled:opacity-50"
                    >
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        {pending === "accurate" ? "提交中…" : "准确"}
                    </button>
                    <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => submit("inaccurate")}
                        className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--color-brand-espresso)]/15 bg-white px-3 text-[12px] text-[var(--color-brand-cocoa)] transition-colors hover:border-[var(--color-report-danger)]/40 hover:text-[var(--color-report-danger)] disabled:opacity-50"
                    >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                        {pending === "inaccurate" ? "提交中…" : "不准确"}
                    </button>
                </div>
            )}
        </section>
    );
}
