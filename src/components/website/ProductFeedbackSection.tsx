"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { fetchWithCsrf, fetchWithTimeout } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { cn } from "@/lib/utils";

interface PendingItem {
    sessionId: string;
    completedAt: string;
    daysSince: number;
    productId: string;
    productName: string;
    category?: string;
    image?: string;
    reason?: string;
}

const EFFECT_OPTIONS = [
    { value: "improved", label: "改善明显" },
    { value: "slight", label: "略有改善" },
    { value: "none", label: "没有变化" },
    { value: "worse", label: "变差" },
];

const SKIN_FEEL_OPTIONS = [
    { value: "light", label: "清爽" },
    { value: "moist", label: "滋润" },
    { value: "sticky", label: "略黏" },
    { value: "irritating", label: "有刺激" },
];

/**
 * 站内产品反馈：进入护肤档案时加载「已完成 28 天以上、尚未反馈」的推荐产品
 */
export function ProductFeedbackSection() {
    const toast = useToast();
    const { trackEvent } = useAdvisorAnalytics();
    const [items, setItems] = useState<PendingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selected, setSelected] = useState<PendingItem | null>(null);
    const [rating, setRating] = useState(0);
    const [skinFeel, setSkinFeel] = useState("");
    const [effect, setEffect] = useState("");
    const [repurchase, setRepurchase] = useState<boolean | null>(null);
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const res = await fetchWithTimeout(
                "/api/user/product-feedback/pending",
                {},
                8000,
            );
            if (!res.ok) throw new Error("load failed");
            const data = (await res.json()) as { items?: PendingItem[] };
            setItems(Array.isArray(data.items) ? data.items : []);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const openForm = (item: PendingItem) => {
        setSelected(item);
        setRating(0);
        setSkinFeel("");
        setEffect("");
        setRepurchase(null);
        setNote("");
    };

    const closeForm = () => {
        if (submitting) return;
        setSelected(null);
    };

    const submit = async () => {
        if (!selected || submitting) return;
        if (rating < 1) {
            toast.warning("请先给产品打分");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetchWithCsrf("/api/user/product-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: selected.productId,
                    sessionId: selected.sessionId,
                    rating,
                    skinFeel: skinFeel || null,
                    effect: effect || null,
                    repurchase,
                    note: note.trim() || null,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(
                    (data as { error?: string }).error ||
                        "提交失败，请稍后重试",
                );
            }
            trackEvent("feedback_submit", {
                targetType: "product",
                productId: selected.productId,
                rating,
            });
            setItems((previous) =>
                previous.filter(
                    (item) =>
                        !(
                            item.productId === selected.productId &&
                            item.sessionId === selected.sessionId
                        ),
                ),
            );
            setSelected(null);
            toast.success("感谢反馈，已记录你的使用感受");
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "提交失败，请稍后重试",
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || error || items.length === 0) return null;

    return (
        <section className="mb-8" aria-labelledby="product-feedback-title">
            <div className="mb-3 flex items-center justify-between">
                <h3
                    id="product-feedback-title"
                    className="flex items-center gap-2 text-sm font-medium"
                >
                    <Star className="size-4 text-muted-foreground" />
                    产品使用反馈
                </h3>
                <span className="text-xs text-muted-foreground">
                    {items.length} 款待反馈
                </span>
            </div>
            <div className="space-y-2">
                {items.map((item) => (
                    <div
                        key={`${item.sessionId}-${item.productId}`}
                        className="flex items-center gap-3 rounded-lg border bg-card p-3"
                    >
                        {item.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={item.image}
                                alt=""
                                className="size-12 shrink-0 rounded-md object-cover"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                                {item.productName}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                已使用 {item.daysSince} 天
                                {item.category ? ` · ${item.category}` : ""}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openForm(item)}
                            className="shrink-0"
                        >
                            填写反馈
                        </Button>
                    </div>
                ))}
            </div>

            <ResponsiveDialog
                open={!!selected}
                onOpenChange={(open) => {
                    if (!open) closeForm();
                }}
                title={selected?.productName}
                description={
                    selected
                        ? `使用 ${selected.daysSince} 天后的真实感受`
                        : undefined
                }
                size="md"
                dismissible={!submitting}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={closeForm}
                            disabled={submitting}
                        >
                            取消
                        </Button>
                        <Button
                            type="button"
                            onClick={submit}
                            loading={submitting}
                        >
                            提交反馈
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <p className="mb-2 text-sm font-medium">整体评分</p>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((value) => (
                                <Button
                                    key={value}
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setRating(value)}
                                    aria-label={`${value} 星`}
                                    className="size-9"
                                >
                                    <Star
                                        className={cn(
                                            "size-6",
                                            value <= rating
                                                ? "fill-report-gold text-report-gold"
                                                : "text-muted-foreground/30",
                                        )}
                                    />
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium">肤感</p>
                        <div className="flex flex-wrap gap-2">
                            {SKIN_FEEL_OPTIONS.map((option) => {
                                const active = skinFeel === option.value;
                                return (
                                    <Button
                                        key={option.value}
                                        type="button"
                                        size="sm"
                                        variant={
                                            active ? "default" : "outline"
                                        }
                                        onClick={() =>
                                            setSkinFeel(
                                                active ? "" : option.value,
                                            )
                                        }
                                        className="rounded-full"
                                    >
                                        {option.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium">效果变化</p>
                        <div className="flex flex-wrap gap-2">
                            {EFFECT_OPTIONS.map((option) => {
                                const active = effect === option.value;
                                return (
                                    <Button
                                        key={option.value}
                                        type="button"
                                        size="sm"
                                        variant={
                                            active ? "default" : "outline"
                                        }
                                        onClick={() =>
                                            setEffect(
                                                active ? "" : option.value,
                                            )
                                        }
                                        className="rounded-full"
                                    >
                                        {option.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium">是否愿意回购</p>
                        <div className="flex gap-2">
                            {[
                                { value: true, label: "愿意" },
                                { value: false, label: "暂不" },
                            ].map((option) => {
                                const active = repurchase === option.value;
                                return (
                                    <Button
                                        key={option.label}
                                        type="button"
                                        size="sm"
                                        variant={
                                            active ? "default" : "outline"
                                        }
                                        onClick={() =>
                                            setRepurchase(option.value)
                                        }
                                        className="rounded-full"
                                    >
                                        {option.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    <Textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        maxLength={200}
                        rows={3}
                        placeholder="补充说明（可选）"
                        className="resize-none"
                    />
                </div>
            </ResponsiveDialog>
        </section>
    );
}
