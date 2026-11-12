"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { fetchWithCsrf, fetchWithTimeout } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";

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
 * 站内产品反馈：进入护肤档案时加载「已完成 28 天以上、尚未反馈」的推荐产品。
 * 通知专项（微信订阅消息）后续接入；这里先保证站内闭环。
 */
export function ProductFeedbackSection() {
    const toast = useToast();
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
            const res = await fetchWithTimeout("/api/user/product-feedback/pending", {}, 8000);
            if (!res.ok) throw new Error("load failed");
            const data = await res.json() as { items?: PendingItem[] };
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
                throw new Error((data as { error?: string }).error || "提交失败，请稍后重试");
            }
            setItems((prev) => prev.filter((item) => !(
                item.productId === selected.productId && item.sessionId === selected.sessionId
            )));
            setSelected(null);
            toast.success("感谢反馈，已记录你的使用感受");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "提交失败，请稍后重试");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || error || items.length === 0) return null;

    return (
        <section className="mb-8" aria-labelledby="product-feedback-title">
            <div className="mb-3 flex items-center justify-between">
                <h3 id="product-feedback-title" className="flex items-center gap-2 text-[15px] font-medium text-[var(--color-brand-espresso)]">
                    <Star className="h-4 w-4 text-[var(--color-brand-taupe)]" strokeWidth={1.5} />
                    产品使用反馈
                </h3>
                <span className="text-[11px] text-brand-charcoal/50">{items.length} 款待反馈</span>
            </div>
            <div className="space-y-2">
                {items.map((item) => (
                    <div key={`${item.sessionId}-${item.productId}`} className="flex items-center gap-3 rounded-xl border border-brand-charcoal/[0.08] bg-white/65 p-3">
                        {item.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-[var(--color-brand-espresso)]">{item.productName}</p>
                            <p className="mt-0.5 text-[11px] text-brand-charcoal/50">
                                已使用 {item.daysSince} 天{item.category ? ` · ${item.category}` : ""}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => openForm(item)}
                            className="shrink-0 rounded-full border border-[var(--color-brand-cocoa)]/25 px-3 py-1.5 text-[12px] text-[var(--color-brand-cocoa)] transition-colors hover:bg-[var(--color-brand-cocoa)]/[0.06]"
                        >
                            填写反馈
                        </button>
                    </div>
                ))}
            </div>

            {selected && (
                <div className="fixed inset-0 z-[100100] flex items-end justify-center bg-black/25 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="product-feedback-form-title">
                    <div className="w-full max-w-md rounded-2xl bg-[#FDFBF7] p-5 shadow-xl">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <h4 id="product-feedback-form-title" className="text-[15px] font-medium text-[var(--color-brand-espresso)]">
                                    {selected.productName}
                                </h4>
                                <p className="mt-1 text-[11px] text-brand-charcoal/50">使用 {selected.daysSince} 天后的真实感受</p>
                            </div>
                            <button type="button" onClick={closeForm} aria-label="关闭" className="rounded-full p-1 text-brand-charcoal/45 hover:bg-black/5">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="mb-1.5 text-[12px] text-brand-charcoal/65">整体评分</p>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setRating(value)}
                                            aria-label={`${value} 星`}
                                            className="rounded p-0.5"
                                        >
                                            <Star
                                                className={`h-6 w-6 ${value <= rating ? "fill-[#C9A86C] text-[#C9A86C]" : "text-brand-charcoal/20"}`}
                                                strokeWidth={1.5}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="mb-1.5 text-[12px] text-brand-charcoal/65">肤感</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {SKIN_FEEL_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setSkinFeel(option.value === skinFeel ? "" : option.value)}
                                            className={`rounded-full border px-2.5 py-1 text-[11px] ${skinFeel === option.value ? "border-[var(--color-brand-cocoa)]/35 bg-[var(--color-brand-cocoa)]/[0.08] text-[var(--color-brand-cocoa)]" : "border-brand-charcoal/10 text-brand-charcoal/55"}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="mb-1.5 text-[12px] text-brand-charcoal/65">效果变化</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {EFFECT_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setEffect(option.value === effect ? "" : option.value)}
                                            className={`rounded-full border px-2.5 py-1 text-[11px] ${effect === option.value ? "border-[var(--color-brand-cocoa)]/35 bg-[var(--color-brand-cocoa)]/[0.08] text-[var(--color-brand-cocoa)]" : "border-brand-charcoal/10 text-brand-charcoal/55"}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="mb-1.5 text-[12px] text-brand-charcoal/65">是否愿意回购</p>
                                <div className="flex gap-1.5">
                                    {[{ value: true, label: "愿意" }, { value: false, label: "暂不" }].map((option) => (
                                        <button
                                            key={option.label}
                                            type="button"
                                            onClick={() => setRepurchase(option.value)}
                                            className={`rounded-full border px-3 py-1 text-[11px] ${repurchase === option.value ? "border-[var(--color-brand-cocoa)]/35 bg-[var(--color-brand-cocoa)]/[0.08] text-[var(--color-brand-cocoa)]" : "border-brand-charcoal/10 text-brand-charcoal/55"}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <textarea
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                maxLength={200}
                                rows={2}
                                placeholder="补充说明（可选）"
                                className="w-full resize-none rounded-lg border border-brand-charcoal/10 bg-white px-3 py-2 text-[12px] text-brand-charcoal outline-none focus:border-[var(--color-brand-cocoa)]/35"
                            />

                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={closeForm} disabled={submitting} className="h-9 flex-1 rounded-full border border-brand-charcoal/15 text-[12px] text-brand-charcoal/60 disabled:opacity-50">
                                    取消
                                </button>
                                <button type="button" onClick={submit} disabled={submitting} className="h-9 flex-1 rounded-full bg-[var(--color-brand-cocoa)] text-[12px] font-medium text-white disabled:opacity-60">
                                    {submitting ? "提交中…" : "提交反馈"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
