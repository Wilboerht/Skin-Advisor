"use client";

import { useEffect, useState } from "react";
import { Check, CircleHelp, X } from "lucide-react";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { FeedbackReasonDialog } from "./FeedbackReasonDialog";

interface ReportFeedbackProps {
    sessionId?: string;
}

type Verdict = "accurate" | "inaccurate" | "unsure";

function readStoredVerdict(sessionId: string): Verdict | null {
    try {
        const value = sessionStorage.getItem(`report-feedback:${sessionId}`);
        return value === "accurate" || value === "inaccurate" || value === "unsure" ? value : null;
    } catch {
        return null;
    }
}

/**
 * 报告纠错（报告级）：记录用户对整份报告准确度的判断。
 * 支持改判；选择「不准确」后会追问具体原因。
 */
export function ReportFeedback({ sessionId }: ReportFeedbackProps) {
    const toast = useToast();
    const { trackEvent } = useAdvisorAnalytics();
    const [pending, setPending] = useState<Verdict | null>(null);
    const [submitted, setSubmitted] = useState<Verdict | null>(null);
    const [reasonOpen, setReasonOpen] = useState(false);

    // 挂载后再读 sessionStorage，避免 SSR/水合不一致
    useEffect(() => {
        if (!sessionId) return;
        setSubmitted(readStoredVerdict(sessionId));
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId || !submitted) return;
        try {
            sessionStorage.setItem(`report-feedback:${sessionId}`, submitted);
        } catch { /* ignore */ }
    }, [sessionId, submitted]);

    if (!sessionId) return null;

    const submit = async (verdict: Verdict) => {
        if (pending) return;
        if (submitted === verdict) {
            // 已选「不准确」时再次点击 = 补充原因
            if (verdict === "inaccurate") setReasonOpen(true);
            return;
        }
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
            if (verdict === "inaccurate") setReasonOpen(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "反馈失败，请稍后重试");
        } finally {
            setPending(null);
        }
    };

    const baseButton = "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] transition-colors disabled:opacity-50";
    const idleButton = "border-[var(--color-brand-espresso)]/15 bg-card text-[var(--color-brand-cocoa)]";

    return (
        <>
            <section aria-labelledby="report-feedback-title" className="rounded-2xl border border-[var(--color-brand-espresso)]/12 bg-card/55 px-4 py-3 lg:px-5 lg:py-4">
                <h4 id="report-feedback-title" className="text-sm font-medium text-[var(--color-brand-espresso)]">
                    这份报告准确吗？
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-brand-taupe)]">
                    你的反馈会帮助我们改进分析，让下一次报告更贴近你的实际情况。
                </p>
                {submitted && (
                    <p role="status" className="mt-2 text-[12px] text-[var(--color-report-success)]">已收到你的反馈，感谢。</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => submit("accurate")}
                        aria-pressed={submitted === "accurate"}
                        className={`${baseButton} ${
                            submitted === "accurate"
                                ? "border-[var(--color-report-success)]/50 bg-[var(--color-report-success)]/10 text-[var(--color-report-success)]"
                                : `${idleButton} hover:border-[var(--color-report-success)]/40 hover:text-[var(--color-report-success)]`
                        }`}
                    >
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        {pending === "accurate" ? "提交中…" : "准确"}
                    </button>
                    <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => submit("inaccurate")}
                        aria-pressed={submitted === "inaccurate"}
                        className={`${baseButton} ${
                            submitted === "inaccurate"
                                ? "border-[var(--color-report-danger)]/50 bg-[var(--color-report-danger)]/10 text-[var(--color-report-danger)]"
                                : `${idleButton} hover:border-[var(--color-report-danger)]/40 hover:text-[var(--color-report-danger)]`
                        }`}
                    >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                        {pending === "inaccurate" ? "提交中…" : "不准确"}
                    </button>
                    <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => submit("unsure")}
                        aria-pressed={submitted === "unsure"}
                        className={`${baseButton} ${
                            submitted === "unsure"
                                ? "border-[var(--color-brand-taupe)]/50 bg-[var(--color-brand-taupe)]/10 text-[var(--color-brand-taupe)]"
                                : `${idleButton} hover:border-[var(--color-brand-taupe)]/40 hover:text-[var(--color-brand-taupe)]`
                        }`}
                    >
                        <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} />
                        {pending === "unsure" ? "提交中…" : "不确定"}
                    </button>
                </div>
            </section>
            <FeedbackReasonDialog
                open={reasonOpen}
                sessionId={sessionId}
                targetType="report"
                targetKey="report"
                targetLabel="整份报告"
                onClose={() => setReasonOpen(false)}
            />
        </>
    );
}
