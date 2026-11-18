"use client";

import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { FeedbackReasonDialog } from "./FeedbackReasonDialog";

interface ReportFeedbackButtonProps {
    sessionId?: string;
    targetType: "dimension" | "finding";
    targetKey: string;
    /** 展示给用户的反馈对象（维度名/问题标题） */
    targetLabel?: string;
    className?: string;
}

function storageKey(sessionId: string, targetType: string, targetKey: string): string {
    return `report-feedback-item:${sessionId}:${targetType}:${targetKey}`;
}

/** 维度/问题级纠错：记录“不准确”，再次点击可撤销；报告级准确度由 ReportFeedback 承载 */
export function ReportFeedbackButton({ sessionId, targetType, targetKey, targetLabel, className }: ReportFeedbackButtonProps) {
    const toast = useToast();
    const { trackEvent } = useAdvisorAnalytics();
    const [submitted, setSubmitted] = useState(false);
    const [pending, setPending] = useState(false);
    const [reasonOpen, setReasonOpen] = useState(false);

    // 挂载后再读 sessionStorage，避免 SSR/水合不一致
    useEffect(() => {
        if (!sessionId) return;
        try {
            setSubmitted(sessionStorage.getItem(storageKey(sessionId, targetType, targetKey)) === "1");
        } catch { /* ignore */ }
    }, [sessionId, targetType, targetKey]);

    if (!sessionId) return null;

    const endpoint = `/api/advisor/reports/${encodeURIComponent(sessionId)}/feedback`;

    const persist = (value: boolean) => {
        try {
            if (value) {
                sessionStorage.setItem(storageKey(sessionId, targetType, targetKey), "1");
            } else {
                sessionStorage.removeItem(storageKey(sessionId, targetType, targetKey));
            }
        } catch { /* ignore */ }
    };

    const submit = async () => {
        if (pending) return;
        setPending(true);
        try {
            const res = await fetchWithCsrf(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetType, targetKey, verdict: "inaccurate" }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error || "反馈失败，请稍后重试");
            }
            setSubmitted(true);
            persist(true);
            trackEvent("feedback_submit", { targetType, targetKey, verdict: "inaccurate" });
            toast.success("已记录，感谢反馈");
            setReasonOpen(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "反馈失败，请稍后重试");
        } finally {
            setPending(false);
        }
    };

    const revoke = async () => {
        if (pending) return;
        setPending(true);
        try {
            const params = new URLSearchParams({ targetType, targetKey });
            const res = await fetchWithCsrf(`${endpoint}?${params.toString()}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error || "撤销失败，请稍后重试");
            }
            setSubmitted(false);
            persist(false);
            trackEvent("feedback_submit", { targetType, targetKey, verdict: "inaccurate", action: "revoke" });
            toast.success("已撤销反馈");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "撤销失败，请稍后重试");
        } finally {
            setPending(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={submitted ? revoke : submit}
                disabled={pending}
                className={className || "inline-flex items-center gap-1 text-[11px] text-[var(--color-brand-taupe)] transition-colors hover:text-[var(--color-brand-cocoa)] disabled:opacity-60"}
                aria-label={submitted ? "撤销这条不准确反馈" : "标记这条判断不准确"}
            >
                <CircleHelp className="h-3 w-3" strokeWidth={1.8} />
                {pending ? "提交中…" : submitted ? "已反馈 · 撤销" : "哪里不准？"}
            </button>
            <FeedbackReasonDialog
                open={reasonOpen}
                sessionId={sessionId}
                targetType={targetType}
                targetKey={targetKey}
                targetLabel={targetLabel}
                onClose={() => setReasonOpen(false)}
            />
        </>
    );
}
