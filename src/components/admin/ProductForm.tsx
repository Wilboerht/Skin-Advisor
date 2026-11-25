"use client";

import { adminFetch } from "@/lib/admin-fetch";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { FormActions } from "@/components/admin/FormActions";
import { cn } from "@/lib/utils";
import {
    ProductFormData,
    SKIN_TYPE_OPTIONS,
    MAX_NAME_LENGTH,
    MAX_PRICE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_HOW_TO_USE_LENGTH,
    MAX_ORIGIN_LENGTH,
    MAX_CAPACITY_LENGTH,
    MAX_TAG_ITEM_LENGTH,
} from "@/types/product";
import { normalizeProductPurchaseLinks } from "@/lib/product-links";

// ==================== 子组件 ====================

/** Tag 输入组件 */
function TagInput({
    label,
    values,
    onChange,
    required = false,
    error,
    placeholder = "添加...",
}: {
    label: string;
    values: string[];
    onChange: (vals: string[]) => void;
    required?: boolean;
    error?: string;
    placeholder?: string;
}) {
    const [input, setInput] = useState("");
    const addTag = () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        if (trimmed.length > MAX_TAG_ITEM_LENGTH) {
            return;
        }
        if (!values.includes(trimmed)) {
            onChange([...values, trimmed]);
        }
        setInput("");
    };
    const removeTag = (i: number) =>
        onChange(values.filter((_, idx) => idx !== i));

    return (
        <div>
            <label className="block text-sm font-medium text-foreground/75 mb-2">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="flex flex-wrap gap-2 min-h-[42px] p-2 rounded-lg border border-border/80 bg-card focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary/20 transition-all">
                {values.map((tag, i) => (
                    <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-charcoal/[0.03] text-sm font-medium text-foreground"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(i)}
                            className="min-w-[28px] min-h-[28px] flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                            aria-label={`删除 ${tag}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <div className="flex items-center flex-1 min-w-[80px] gap-1">
                    <input
                        type="text"
                        value={input}
                        maxLength={MAX_TAG_ITEM_LENGTH}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addTag();
                            } else if (e.key === "," || e.key === "，") {
                                e.preventDefault();
                                addTag();
                            }
                        }}
                        className="w-full text-sm text-foreground placeholder:text-muted-foreground outline-none bg-transparent py-1"
                        placeholder={values.length === 0 ? placeholder : ""}
                        aria-invalid={!!error}
                    />
                    {input.trim() && (
                        <button
                            type="button"
                            onClick={addTag}
                            className="text-xs px-2 py-1 rounded-md bg-brand-charcoal/[0.03] text-muted-foreground hover:bg-brand-charcoal/[0.06] transition-colors"
                        >
                            添加
                        </button>
                    )}
                </div>
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
}

/** Toggle 开关 */
function Toggle({
    label,
    checked,
    onChange,
    tooltip,
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    tooltip?: string;
}) {
    return (
        <div className="flex items-center gap-3 group">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Spacebar") {
                        e.preventDefault();
                        onChange(!checked);
                    }
                }}
                className="flex items-center gap-3"
            >
                <div
                    className={cn(
                        "relative w-11 h-6 rounded-full transition-colors duration-200",
                        checked ? "bg-brand-primary" : "bg-brand-charcoal/20",
                    )}
                >
                    <div
                        className={cn(
                            "absolute top-0.5 left-0.5 w-5 h-5 bg-card rounded-full shadow-sm transition-transform duration-200",
                            checked ? "translate-x-5" : "translate-x-0",
                        )}
                    />
                </div>
                <span className="text-sm font-medium text-foreground/75">
                    {label}
                </span>
            </button>
            {tooltip && (
                <div className="relative">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-charcoal/10 text-[10px] font-bold text-muted-foreground cursor-help">
                        ?
                    </span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-brand-charcoal text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                        {tooltip}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-brand-charcoal" />
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== 表单主体 ====================

export type { ProductFormData };

type FormErrors = Record<string, string>;

const READ_ONLY_INPUT_CLASS =
    "block w-full cursor-not-allowed rounded-lg border border-border/80 bg-brand-charcoal/[0.02] p-3 text-sm text-foreground/75 outline-none";

export default function ProductForm({
    initialData,
    onSuccess,
    onCancel,
    onSubmittingChange,
    onDirtyChange,
}: {
    initialData: ProductFormData;
    onSuccess?: () => void;
    onCancel?: () => void;
    onSubmittingChange?: (submitting: boolean) => void;
    onDirtyChange?: (dirty: boolean) => void;
}) {
    const router = useRouter();
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const isMissing = Boolean(initialData.sourceMissingAt);
    const mainEditUrl = initialData.sourceProductId
        ? `https://nihplod.cn/admin/products/${initialData.sourceProductId}/edit`
        : null;
    const syncedAtLabel = initialData.sourceSyncedAt
        ? new Date(initialData.sourceSyncedAt).toLocaleString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
          })
        : null;

    const [active, setActive] = useState(initialData.active ?? true);
    const [featured, setFeatured] = useState(initialData.featured ?? false);

    const images = initialData.images?.length
        ? initialData.images
        : initialData.image
          ? [initialData.image]
          : [];

    const purchaseLinks = normalizeProductPurchaseLinks(
        initialData.purchaseLinks,
        initialData.affiliateLinks,
    ).filter(
        (link) =>
            link.url || link.miniProgramShortLink || link.storeProductId,
    );

    const [keyIngredients, setKeyIngredients] = useState<string[]>(
        initialData.keyIngredients || [],
    );
    const [benefits, setBenefits] = useState<string[]>(
        initialData.benefits || [],
    );
    const [negativeFor, setNegativeFor] = useState<string[]>(
        initialData.negativeFor || [],
    );
    const [suitableSkinTypes, setSuitableSkinTypes] = useState<string[]>(
        initialData.suitableSkinTypes || [],
    );

    const [recommendReasons, setRecommendReasons] = useState<
        Record<string, string | Record<string, string>>
    >(
        (initialData.recommendReasons as Record<
            string,
            string | Record<string, string>
        >) || {},
    );

    const clearError = (key: string) => {
        setErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        const newErrors: FormErrors = {};
        if (!keyIngredients.length) newErrors.keyIngredients = "请填写核心成分";
        if (!benefits.length) newErrors.benefits = "请填写主要功效";
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            const firstErr = document.querySelector("[aria-invalid='true']");
            firstErr?.scrollIntoView({ behavior: "smooth", block: "center" });
            toast.error("请补齐推荐属性");
            return;
        }

        setSaving(true);
        onSubmittingChange?.(true);

        try {
            const res = await adminFetch(
                `/api/admin/products/${initialData.id}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        active,
                        featured,
                        keyIngredients,
                        benefits,
                        negativeFor,
                        suitableSkinTypes,
                        recommendReasons:
                            Object.keys(recommendReasons).length > 0
                                ? recommendReasons
                                : null,
                    }),
                },
            );
            if (!res.ok) {
                let message = "保存失败";
                try {
                    const data = await res.json();
                    message = data.error || message;
                } catch {
                    // ignore parse error
                }
                throw new Error(message);
            }
            toast.success("产品推荐属性已更新");
            if (onSuccess) {
                onSuccess();
            } else {
                router.push("/admin/products");
                router.refresh();
            }
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "保存产品时出错");
        } finally {
            setSaving(false);
            onSubmittingChange?.(false);
        }
    };

    // ===== 未保存更改检测 =====
    const [initialSnapshot] = useState(() => ({
        active: initialData.active ?? true,
        featured: initialData.featured ?? false,
        keyIngredients: [...(initialData.keyIngredients || [])],
        benefits: [...(initialData.benefits || [])],
        negativeFor: [...(initialData.negativeFor || [])],
        suitableSkinTypes: [...(initialData.suitableSkinTypes || [])],
        recommendReasons: { ...(initialData.recommendReasons || {}) },
    }));

    const dirty =
        JSON.stringify({
            active,
            featured,
            keyIngredients,
            benefits,
            negativeFor,
            suitableSkinTypes,
            recommendReasons,
        }) !== JSON.stringify(initialSnapshot);

    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    useEffect(() => {
        if (!dirty) return;
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [dirty]);

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-xl border border-brand-primary/15 bg-brand-primary/[0.04] px-4 py-3 text-sm text-foreground/75">
                <div className="font-medium text-foreground">
                    基础信息由主站同步；子站维护推荐属性
                </div>
                <p className="mt-1 leading-relaxed">
                    名称、分类、价格、产地、规格、图片、描述、使用方法与购买链接由主站维护，子站不可修改；下方推荐属性、上下架与精选仍可编辑。
                </p>
                {isMissing && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                        主站已删除该产品，子站已自动停用。确认不再需要后可删除本地记录。
                    </p>
                )}
                {!initialData.sourceProductId && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                        本地历史产品：基础信息已冻结，请由主站创建并同步后迁移/停用。
                    </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {syncedAtLabel && <span>最近同步：{syncedAtLabel}</span>}
                    {mainEditUrl && !isMissing && (
                        <a
                            href={mainEditUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-brand-primary hover:underline"
                        >
                            去主站编辑
                        </a>
                    )}
                </div>
            </div>

            <div className="space-y-5">
                {/* ===== 基本信息（只读） ===== */}
                <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5">
                    <div className="mb-4">
                        <h2 className="text-base font-medium text-foreground">
                            基本信息
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            名称、分类、价格、产地、规格、描述、使用方法由主站维护
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-foreground/75 mb-1.5">
                                产品名称
                            </label>
                            <input
                                type="text"
                                value={initialData.name || ""}
                                disabled
                                maxLength={MAX_NAME_LENGTH}
                                className={READ_ONLY_INPUT_CLASS}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground/75 mb-1.5">
                                分类
                            </label>
                            <input
                                type="text"
                                value={initialData.category || ""}
                                disabled
                                className={READ_ONLY_INPUT_CLASS}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground/75 mb-1.5">
                                价格
                            </label>
                            <input
                                type="text"
                                value={initialData.price || ""}
                                disabled
                                maxLength={MAX_PRICE_LENGTH}
                                className={READ_ONLY_INPUT_CLASS}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground/75 mb-1.5">
                                产地
                            </label>
                            <input
                                type="text"
                                value={initialData.origin || ""}
                                disabled
                                maxLength={MAX_ORIGIN_LENGTH}
                                className={READ_ONLY_INPUT_CLASS}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground/75 mb-1.5">
                                规格容量
                            </label>
                            <input
                                type="text"
                                value={initialData.capacity || ""}
                                disabled
                                maxLength={MAX_CAPACITY_LENGTH}
                                className={READ_ONLY_INPUT_CLASS}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-foreground/75 mb-1.5">
                                产品状态
                            </label>
                            <div className="flex items-center gap-6 h-[46px]">
                                <Toggle
                                    label="上架状态"
                                    checked={active}
                                    onChange={setActive}
                                />
                                <Toggle
                                    label="精选置顶"
                                    checked={featured}
                                    onChange={setFeatured}
                                    tooltip="给该产品增加排序权重，使其在算法推荐中更容易排在前面。不勾选也会被算法自动推荐。"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground/75 mb-1.5">
                                产品描述
                            </label>
                            <textarea
                                rows={3}
                                value={initialData.description || ""}
                                disabled
                                maxLength={MAX_DESCRIPTION_LENGTH}
                                className={cn(
                                    READ_ONLY_INPUT_CLASS,
                                    "resize-none",
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground/75 mb-1.5">
                                使用方法
                            </label>
                            <textarea
                                rows={3}
                                value={initialData.howToUse || ""}
                                disabled
                                maxLength={MAX_HOW_TO_USE_LENGTH}
                                className={cn(
                                    READ_ONLY_INPUT_CLASS,
                                    "resize-none",
                                )}
                            />
                        </div>
                    </div>
                </section>

                {/* ===== 产品图片（只读） ===== */}
                <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5">
                    <div className="mb-4">
                        <h2 className="text-base font-medium text-foreground">
                            产品图片
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            图片由主站维护，第 1 张为封面
                        </p>
                    </div>
                    {images.length > 0 ? (
                        <div className="grid grid-cols-5 gap-2">
                            {images.map((url, index) => (
                                <div
                                    key={`${url}-${index}`}
                                    className={cn(
                                        "relative aspect-square rounded-lg overflow-hidden border-2",
                                        index === 0
                                            ? "border-brand-primary"
                                            : "border-border/80",
                                    )}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={url}
                                        className="w-full h-full object-cover"
                                        alt={`产品图片 ${index + 1}`}
                                    />
                                    {index === 0 && (
                                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-primary text-white">
                                            封面
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground/80">
                            主站暂未配置产品图片
                        </p>
                    )}
                </section>

                {/* ===== 成分与功效（子站维护） ===== */}
                <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5">
                    <div className="mb-4">
                        <h2 className="text-base font-medium text-foreground">
                            成分与功效
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            由子站维护核心成分、功效与不适用人群
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <TagInput
                            label="核心成分"
                            values={keyIngredients}
                            onChange={(values) => {
                                setKeyIngredients(values);
                                clearError("keyIngredients");
                            }}
                            required
                            error={errors.keyIngredients}
                            placeholder="输入成分名称，按回车添加"
                        />
                        <TagInput
                            label="主要功效"
                            values={benefits}
                            onChange={(values) => {
                                setBenefits(values);
                                clearError("benefits");
                            }}
                            required
                            error={errors.benefits}
                            placeholder="如：保湿、抗老、提亮..."
                        />
                        <TagInput
                            label="不适合人群"
                            values={negativeFor}
                            onChange={setNegativeFor}
                            placeholder="如：敏感肌、孕妇..."
                        />
                    </div>
                </section>

                {/* ===== 肤质与购买渠道 ===== */}
                <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5">
                    <div className="mb-4">
                        <h2 className="text-base font-medium text-foreground">
                            适用肤质与购买方式
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            子站维护适用肤质；购买链接由主站同步
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground/75 mb-3">
                            适用肤质
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {SKIN_TYPE_OPTIONS.map((opt) => {
                                const selected = suitableSkinTypes.includes(
                                    opt.value,
                                );
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            setSuitableSkinTypes((prev) =>
                                                prev.includes(opt.value)
                                                    ? prev.filter(
                                                          (v) =>
                                                              v !== opt.value,
                                                      )
                                                    : [...prev, opt.value],
                                            );
                                        }}
                                        className={cn(
                                            "px-3.5 py-2 rounded-lg text-sm font-medium border transition-all",
                                            selected
                                                ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                                                : "bg-card text-foreground/75 border-border/80 hover:border-brand-primary/60",
                                        )}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            {selected && (
                                                <Check className="w-3.5 h-3.5" />
                                            )}
                                            {opt.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="mb-3">
                            <label className="block text-sm font-medium text-foreground/75">
                                购买渠道
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">
                                购买链接由主站维护，子站不可修改。
                            </p>
                        </div>
                        {purchaseLinks.length === 0 ? (
                            <p className="text-sm text-muted-foreground/80">
                                主站暂未配置购买链接
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {purchaseLinks.map((link) => (
                                    <div
                                        key={link.platformKey}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-brand-charcoal/[0.02] px-3 py-2"
                                    >
                                        <span className="text-sm font-medium text-foreground/75">
                                            {link.platform}
                                        </span>
                                        <span
                                            className="min-w-0 max-w-full truncate font-mono text-xs text-muted-foreground"
                                            title={
                                                link.url ||
                                                link.miniProgramShortLink ||
                                                link.storeProductId ||
                                                ""
                                            }
                                        >
                                            {link.url ||
                                                link.miniProgramShortLink ||
                                                link.storeProductId}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* ===== 肤质推荐理由（子站维护） ===== */}
                <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5">
                    <div className="mb-4">
                        <h2 className="text-base font-medium text-foreground">
                            推荐理由
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            为不同肤质配置推荐文案
                        </p>
                    </div>
                    <label className="block text-sm font-medium text-foreground/75 mb-3">
                        肤质推荐理由
                        <span className="text-xs text-muted-foreground font-normal ml-2">
                            为不同肤质配置推荐文案，支持按季节精细化配置
                        </span>
                    </label>
                    <div className="space-y-3">
                        {SKIN_TYPE_OPTIONS.map((opt) => {
                            const entry = recommendReasons[opt.value];
                            const isExpanded =
                                typeof entry === "object" && entry !== null;
                            const defaultText =
                                typeof entry === "string"
                                    ? entry
                                    : (entry as Record<string, string>)
                                          ?.default || "";
                            const seasonObj =
                                typeof entry === "object" && entry !== null
                                    ? (entry as Record<string, string>)
                                    : {};

                            const updateEntry = (
                                newVal: string | Record<string, string>,
                            ) => {
                                setRecommendReasons((prev) => {
                                    const next = { ...prev };
                                    if (
                                        typeof newVal === "string" &&
                                        !newVal.trim()
                                    ) {
                                        delete next[opt.value];
                                    } else {
                                        next[opt.value] = newVal;
                                    }
                                    return next;
                                });
                            };

                            const expandToSeasons = () => {
                                updateEntry({
                                    default: defaultText,
                                    spring: "",
                                    early_summer: "",
                                    midsummer: "",
                                    autumn: "",
                                    winter: "",
                                });
                            };

                            const collapseToString = () => {
                                updateEntry(defaultText || "");
                            };

                            return (
                                <div
                                    key={opt.value}
                                    className="rounded-lg border border-border/80 bg-card p-3"
                                >
                                    <div className="flex items-start gap-3">
                                        <span
                                            className={cn(
                                                "shrink-0 mt-1 px-2 py-0.5 rounded-md text-xs font-medium border",
                                                opt.color,
                                            )}
                                        >
                                            {opt.label}
                                        </span>
                                        <div className="flex-1 space-y-2">
                                            <textarea
                                                rows={2}
                                                value={defaultText}
                                                maxLength={500}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (isExpanded) {
                                                        updateEntry({
                                                            ...seasonObj,
                                                            default: val,
                                                        });
                                                    } else {
                                                        updateEntry(val);
                                                    }
                                                }}
                                                placeholder={`为${opt.label}撰写推荐理由...`}
                                                className="w-full rounded-lg border border-border/80 text-sm p-2 outline-none resize-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all bg-card placeholder:text-muted-foreground"
                                            />

                                            <div className="flex items-center gap-2">
                                                {!isExpanded ? (
                                                    <button
                                                        type="button"
                                                        onClick={
                                                            expandToSeasons
                                                        }
                                                        className="text-xs text-brand-primary hover:text-brand-primary underline underline-offset-2"
                                                    >
                                                        + 按季节精细化配置
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={
                                                                collapseToString
                                                            }
                                                            className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2"
                                                        >
                                                            - 收起季节配置
                                                        </button>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            留空则使用默认文案
                                                        </span>
                                                    </>
                                                )}
                                            </div>

                                            {isExpanded && (
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                                                    {[
                                                        {
                                                            key: "spring",
                                                            label: "春季",
                                                        },
                                                        {
                                                            key: "early_summer",
                                                            label: "初夏",
                                                        },
                                                        {
                                                            key: "midsummer",
                                                            label: "盛夏",
                                                        },
                                                        {
                                                            key: "autumn",
                                                            label: "秋季",
                                                        },
                                                        {
                                                            key: "winter",
                                                            label: "冬季",
                                                        },
                                                    ].map(({ key, label }) => (
                                                        <div
                                                            key={key}
                                                            className="flex flex-col gap-1"
                                                        >
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {label}
                                                            </span>
                                                            <input
                                                                type="text"
                                                                value={
                                                                    seasonObj[
                                                                        key
                                                                    ] || ""
                                                                }
                                                                maxLength={500}
                                                                onChange={(
                                                                    e,
                                                                ) => {
                                                                    updateEntry(
                                                                        {
                                                                            ...seasonObj,
                                                                            [key]: e
                                                                                .target
                                                                                .value,
                                                                        },
                                                                    );
                                                                }}
                                                                placeholder="可选"
                                                                className="w-full rounded-md border border-border/80 text-xs p-1.5 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all bg-card placeholder:text-muted-foreground"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            <FormActions
                sticky
                start={
                    <p className="text-xs text-muted-foreground">
                        基础信息只读，保存仅更新推荐属性
                    </p>
                }
            >
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => (onCancel ? onCancel() : router.back())}
                >
                    取消
                </Button>
                <Button type="submit" loading={saving}>
                    保存修改
                </Button>
            </FormActions>
        </form>
    );
}
