"use client";

import { useEffect, useState } from "react";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

interface FeedbackReasonDialogProps {
    open: boolean;
    sessionId: string;
    targetType: "dimension" | "finding" | "report";
    targetKey: string;
    targetLabel?: string;
    onClose: () => void;
}

const REASON_OPTIONS = [
    "判断和实际不符",
    "描述看不懂",
    "建议不适合我",
    "其他",
];

/**
 * 「哪里不准」追问弹层：统一 ResponsiveDialog + Button + Textarea
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
                    body: JSON.stringify({
                        targetType,
                        targetKey,
                        verdict: "inaccurate",
                        note: composed,
                    }),
                },
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(
                    (data as { error?: string }).error ||
                        "提交失败，请稍后重试",
                );
            }
            trackEvent("feedback_submit", {
                targetType,
                targetKey,
                verdict: "inaccurate",
                action: "reason",
            });
            toast.success("已记录原因，感谢反馈");
            onClose();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "提交失败，请稍后重试",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) handleClose();
            }}
            title="哪里不准？"
            description={
                targetLabel
                    ? `关于「${targetLabel}」：补充原因能帮我们更快定位问题，不选也可以直接关闭。`
                    : "补充原因能帮我们更快定位问题，不选也可以直接关闭。"
            }
            size="md"
            dismissible={!submitting}
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={submitting}
                    >
                        暂不补充
                    </Button>
                    <Button
                        type="button"
                        onClick={submit}
                        loading={submitting}
                        disabled={!composed}
                    >
                        提交原因
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {REASON_OPTIONS.map((option) => {
                        const selected = reason === option;
                        return (
                            <Button
                                key={option}
                                type="button"
                                size="sm"
                                variant={selected ? "default" : "outline"}
                                aria-pressed={selected}
                                onClick={() =>
                                    setReason(selected ? "" : option)
                                }
                                className="rounded-full"
                            >
                                {option}
                            </Button>
                        );
                    })}
                </div>

                <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={200}
                    rows={3}
                    placeholder="补充说明（可选）"
                    aria-label="补充说明"
                    className="resize-none"
                />
            </div>
        </ResponsiveDialog>
    );
}
