"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useModalBackClose } from "@/hooks/use-modal-back-close";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";

interface FeedbackReasonDialogProps {
    open: boolean;
    sessionId: string;
    targetType: "dimension" | "finding" | "report";
    targetKey: string;
    /** 展示给用户的反馈对象（维度名/问题标题/整份报告），避免补错位置 */
    targetLabel?: string;
    onClose: () => void;
}

const REASON_OPTIONS = [
    { value: "判断和实际不符", label: "判断和实际不符" },
    { value: "描述看不懂", label: "描述看不懂" },
    { value: "建议不适合我", label: "建议不适合我" },
    { value: "其他", label: "其他" },
];

/**
 * 「哪里不准」追问弹层：快捷原因 + 选填备注。
 * 反馈本身在点击「不准确」时已落库，这里只是补充原因，关闭不丢反馈。
 */
export function FeedbackReasonDialog({
    open,
    sessionId,
    targetType,
    targetKey,
    targetLabel,
    onClose,
}: FeedbackReasonDialogProps) {
    const toast = useToast();
    const { trackEvent } = useAdvisorAnalytics();
    const [reason, setReason] = useState("");
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) return;
        setReason("");
        setNote("");
    }, [open]);

    const handleClose = () => {
        if (submitting) return;
        onClose();
    };

    const dialogRef = useFocusTrap<HTMLDivElement>(open, handleClose);
    useModalBackClose(open, handleClose);

    if (!open) return null;

    const composed = [reason, note.trim()].filter(Boolean).join("：");

    const submit = async () => {
        if (submitting || !composed) return;
        setSubmitting(true);
        try {
            const res = await fetchWithCsrf(
                `/api/advisor/reports/${encodeURIComponent(sessionId)}/feedback`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ targetType, targetKey, verdict: "inaccurate", note: composed }),
                }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error || "提交失败，请稍后重试");
            }
            trackEvent("feedback_submit", { targetType, targetKey, verdict: "inaccurate", action: "reason" });
            toast.success("已记录原因，感谢反馈");
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "提交失败，请稍后重试");
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100100] flex items-end justify-center bg-black/25 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-feedback-reason-title"
            onClick={(event) => {
                if (event.target === event.currentTarget) handleClose();
            }}
        >
            <div ref={dialogRef} className="w-full max-w-md rounded-2xl bg-[var(--color-report-paper)] p-5 shadow-xl">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <h4 id="report-feedback-reason-title" className="text-[15px] font-medium text-[var(--color-brand-espresso)]">
                            哪里不准？
                        </h4>
                        <p className="mt-1 text-[11px] leading-relaxed text-brand-charcoal/50">
                            {targetLabel ? `关于「${targetLabel}」：` : ""}补充原因能帮我们更快定位问题，不选也可以直接关闭。
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        aria-label="关闭"
                        className="rounded-full p-1 text-brand-charcoal/45 hover:bg-black/5"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {REASON_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setReason(reason === option.value ? "" : option.value)}
                            aria-pressed={reason === option.value}
                            className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                                reason === option.value
                                    ? "border-[var(--color-brand-cocoa)]/35 bg-[var(--color-brand-cocoa)]/[0.08] text-[var(--color-brand-cocoa)]"
                                    : "border-brand-charcoal/10 text-brand-charcoal/60 hover:border-brand-charcoal/25"
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={200}
                    rows={2}
                    placeholder="补充说明（可选）"
                    aria-label="补充说明"
                    className="mt-3 w-full resize-none rounded-lg border border-brand-charcoal/10 bg-white px-3 py-2 text-[12px] text-brand-charcoal outline-none focus:border-[var(--color-brand-cocoa)]/35"
                />

                <div className="mt-3 flex gap-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="h-9 flex-1 rounded-full border border-brand-charcoal/15 text-[12px] text-brand-charcoal/60 disabled:opacity-50"
                    >
                        暂不补充
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={submitting || !composed}
                        className="h-9 flex-1 rounded-full bg-[var(--color-brand-cocoa)] text-[12px] font-medium text-white disabled:opacity-50"
                    >
                        {submitting ? "提交中…" : "提交原因"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
