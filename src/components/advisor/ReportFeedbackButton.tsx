"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";

interface ReportFeedbackButtonProps {
    sessionId?: string;
    targetType: "dimension" | "finding";
    targetKey: string;
    className?: string;
}

/** 维度/问题级纠错：只记录“不准确”，报告级准确度由 ReportFeedback 承载 */
export function ReportFeedbackButton({ sessionId, targetType, targetKey, className }: ReportFeedbackButtonProps) {
    const toast = useToast();
    const { trackEvent } = useAdvisorAnalytics();
    const [submitted, setSubmitted] = useState(false);
    const [pending, setPending] = useState(false);

    if (!sessionId) return null;

    const submit = async () => {
        if (pending || submitted) return;
        setPending(true);
        try {
            const res = await fetchWithCsrf(`/api/advisor/reports/${encodeURIComponent(sessionId)}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetType, targetKey, verdict: "inaccurate" }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error || "反馈失败，请稍后重试");
            }
            setSubmitted(true);
            trackEvent("feedback_submit", { targetType, targetKey, verdict: "inaccurate" });
            toast.success("已记录，感谢反馈");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "反馈失败，请稍后重试");
        } finally {
            setPending(false);
        }
    };

    return (
        <button
            type="button"
            onClick={submit}
            disabled={pending || submitted}
            className={className || "inline-flex items-center gap-1 text-[11px] text-[var(--color-brand-taupe)] transition-colors hover:text-[var(--color-brand-cocoa)] disabled:opacity-60"}
            aria-label="标记这条判断不准确"
        >
            <CircleHelp className="h-3 w-3" strokeWidth={1.8} />
            {submitted ? "已反馈" : pending ? "提交中…" : "哪里不准？"}
        </button>
    );
}
