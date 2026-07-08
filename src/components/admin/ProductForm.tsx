"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    X, Loader2, Check, ChevronLeft,
    ImageIcon, GripVertical,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
    ProductFormData,
    CATEGORY_OPTIONS,
    SKIN_TYPE_OPTIONS,
    MAX_NAME_LENGTH,
    MAX_PRICE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_HOW_TO_USE_LENGTH,
    MAX_IMAGE_COUNT,
    MAX_TAG_ITEM_LENGTH,
} from "@/types/product";

// ==================== 子组件 ====================

/** Tag 输入组件 */
function TagInput({ label, values, onChange, required = false, error, placeholder = "添加..." }: {
    label: string; values: string[]; onChange: (vals: string[]) => void;
    required?: boolean; error?: string; placeholder?: string;
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
    const removeTag = (i: number) => onChange(values.filter((_, idx) => idx !== i));

    return (
        <div>
            <label className="block text-sm font-medium text-[#5E5E5E] mb-2">
                {label}{required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="flex flex-wrap gap-2 min-h-[42px] p-2 rounded-xl border border-[#E8E2D9] bg-white focus-within:border-[#C9A86C] focus-within:ring-1 focus-within:ring-[#C9A86C]/20 transition-all">
                {values.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF8F5] text-sm font-medium text-[#2C2C2C]">
                        {tag}
                        <button type="button" onClick={() => removeTag(i)} className="text-[#9E9E9E] hover:text-red-500 transition-colors" aria-label={`删除 ${tag}`}>
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
                        className="w-full text-sm text-[#2C2C2C] placeholder:text-[#B0A89A] outline-none bg-transparent py-1"
                        placeholder={values.length === 0 ? placeholder : ""}
                    />
                    {input.trim() && (
                        <button
                            type="button"
                            onClick={addTag}
                            className="text-xs px-2 py-1 rounded-md bg-[#FAF8F5] text-[#8B7355] hover:bg-[#F0EBE3] transition-colors"
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
function Toggle({ label, checked, onChange, tooltip }: { label: string; checked: boolean; onChange: (v: boolean) => void; tooltip?: string }) {
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
                <div className={cn(
                    "relative w-11 h-6 rounded-full transition-colors duration-200",
                    checked ? "bg-[#C9A86C]" : "bg-[#D9D0C3]"
                )}>
                    <div className={cn(
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200",
                        checked ? "translate-x-5" : "translate-x-0"
                    )} />
                </div>
                <span className="text-sm font-medium text-[#5E5E5E]">{label}</span>
            </button>
            {tooltip && (
                <div className="relative">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#E8E2D9] text-[10px] font-bold text-[#8B7355] cursor-help">?</span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-[#2C2C2C] text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                        {tooltip}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#2C2C2C]" />
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== 表单主体 ====================

export type { ProductFormData };

type FormErrors = Record<string, string>;

function validate(formData: Record<string, unknown>, keyIngredients: string[], benefits: string[], images: string[]) {
    const errors: FormErrors = {};
    const getString = (v: unknown): string => typeof v === "string" ? v : "";
    if (!getString(formData.name).trim()) errors.name = "产品名称为必填";
    if (!getString(formData.category).trim()) errors.category = "分类为必填";
    if (!getString(formData.price).trim()) errors.price = "价格为必填";
    if (!getString(formData.description).trim()) errors.description = "描述为必填";
    if (images.length === 0) errors.image = "请上传产品图片";

    if (!keyIngredients.length) errors.keyIngredients = "请填写核心成分";
    if (!benefits.length) errors.benefits = "请填写主要功效";
    return errors;
}

export default function ProductForm({
    initialData,
    onSuccess,
    onCancel,
    onSubmittingChange,
    onDirtyChange,
}: {
    initialData?: ProductFormData | null;
    onSuccess?: () => void;
    onCancel?: () => void;
    onSubmittingChange?: (submitting: boolean) => void;
    onDirtyChange?: (dirty: boolean) => void;
}) {
    const router = useRouter();
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [dragOver, setDragOver] = useState(false);

    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        category: initialData?.category || "",
        price: initialData?.price || "",
        description: initialData?.description || "",
        howToUse: initialData?.howToUse || "",
        active: initialData?.active ?? true,
        featured: initialData?.featured ?? false,
    });

    const [images, setImages] = useState<string[]>(
        initialData?.images || (initialData?.image ? [initialData.image] : [])
    );
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const moveImage = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        setImages((prev) => {
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return next;
        });
    };

    const [affiliateLinks, setAffiliateLinks] = useState<Record<string, string>>({
        taobao: initialData?.affiliateLinks?.taobao || "",
        xiaohongshu: initialData?.affiliateLinks?.xiaohongshu || "",
        douyin: initialData?.affiliateLinks?.douyin || "",
    });

    const [keyIngredients, setKeyIngredients] = useState<string[]>(initialData?.keyIngredients || []);
    const [benefits, setBenefits] = useState<string[]>(initialData?.benefits || []);
    const [negativeFor, setNegativeFor] = useState<string[]>(initialData?.negativeFor || []);
    const [suitableSkinTypes, setSuitableSkinTypes] = useState<string[]>(initialData?.suitableSkinTypes || []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (file: File) => {
        if (!file) return;
        if (images.length >= MAX_IMAGE_COUNT) {
            toast.error(`最多只能上传 ${MAX_IMAGE_COUNT} 张图片`);
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("图片不能超过10MB");
            return;
        }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/admin/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (!res.ok || !data.url) {
                throw new Error(data.error || "上传失败");
            }
            setImages((prev) => [...prev, data.url]);
            toast.success("图片上传成功");
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "上传失败");
        } finally {
            setUploading(false);
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const remaining = MAX_IMAGE_COUNT - images.length;
        const toUpload = files.slice(0, remaining);
        toUpload.forEach((file) => handleImageUpload(file));
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const ALLOWED_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const isValidImageFile = (file: File) => {
        if (file.type.startsWith("image/")) return true;
        const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        return ALLOWED_IMAGE_EXTS.includes(ext);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter(isValidImageFile);
        const remaining = MAX_IMAGE_COUNT - images.length;
        const toUpload = files.slice(0, remaining);
        toUpload.forEach((file) => handleImageUpload(file));
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors = validate(formData, keyIngredients, benefits, images);
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            const firstErr = document.querySelector("[aria-invalid='true']");
            firstErr?.scrollIntoView({ behavior: "smooth", block: "center" });
            toast.error("请完善必填项");
            return;
        }
        setSaving(true);
        onSubmittingChange?.(true);

        const filteredLinks: Record<string, string> = {};
        Object.entries(affiliateLinks).forEach(([k, v]) => {
            if (v.trim()) filteredLinks[k] = v.trim();
        });
        for (const [k, v] of Object.entries(filteredLinks)) {
            try {
                const url = new URL(v);
                if (url.protocol !== "http:" && url.protocol !== "https:") {
                    throw new Error("Invalid protocol");
                }
            } catch {
                setErrors((errs) => ({ ...errs, [`affiliateLinks_${k}`]: "请输入有效链接" }));
                toast.error("请填写有效的电商链接");
                setSaving(false);
                return;
            }
        }

        const payload = {
            ...formData,
            image: images[0] || "",
            images,
            keyIngredients,
            benefits,
            negativeFor,
            suitableSkinTypes,
            affiliateLinks: Object.keys(filteredLinks).length > 0 ? filteredLinks : null,
        };

        try {
            const url = initialData?.id
                ? `/api/admin/products/${initialData.id}`
                : `/api/admin/products`;
            const method = initialData?.id ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
            toast.success(initialData?.id ? "产品已更新" : "产品已创建");
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

    const updateField = useCallback(<K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }, [errors]);

    // ===== 未保存更改检测 =====
    const initialSnapshot = useRef({
        formData: { ...formData },
        images: [...images],
        affiliateLinks: { ...affiliateLinks },
        keyIngredients: [...keyIngredients],
        benefits: [...benefits],
        negativeFor: [...negativeFor],
        suitableSkinTypes: [...suitableSkinTypes],
    });

    useEffect(() => {
        // Report clean state once after initial mount
        onDirtyChange?.(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const dirty =
            JSON.stringify(formData) !== JSON.stringify(initialSnapshot.current.formData) ||
            JSON.stringify(images) !== JSON.stringify(initialSnapshot.current.images) ||
            JSON.stringify(affiliateLinks) !== JSON.stringify(initialSnapshot.current.affiliateLinks) ||
            JSON.stringify(keyIngredients) !== JSON.stringify(initialSnapshot.current.keyIngredients) ||
            JSON.stringify(benefits) !== JSON.stringify(initialSnapshot.current.benefits) ||
            JSON.stringify(negativeFor) !== JSON.stringify(initialSnapshot.current.negativeFor) ||
            JSON.stringify(suitableSkinTypes) !== JSON.stringify(initialSnapshot.current.suitableSkinTypes);
        onDirtyChange?.(dirty);
    }, [formData, images, affiliateLinks, keyIngredients, benefits, negativeFor, suitableSkinTypes, onDirtyChange]);

    return (
        <form onSubmit={handleSubmit} className={cn("space-y-10", !onCancel && "max-w-4xl mx-auto")}>
            <div className="flex-1 min-w-0 space-y-10">

                {/* ===== 基本信息 ===== */}
                <section>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 产品名称 */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-1.5">
                                产品名称 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                maxLength={MAX_NAME_LENGTH}
                                onChange={(e) => updateField("name", e.target.value)}
                                className={cn(
                                    "block w-full rounded-xl border shadow-sm text-sm p-3 outline-none transition-all bg-white",
                                    "focus:border-[#C9A86C] focus:ring-1 focus:ring-[#C9A86C]/20",
                                    errors.name ? "border-red-400 bg-red-50/30" : "border-[#E8E2D9]"
                                )}
                                placeholder="如：NIHPLOD 玻色因面霜"
                                aria-invalid={!!errors.name}
                            />
                            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                        </div>

                        {/* 分类 */}
                        <div>
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-1.5">
                                分类 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => updateField("category", e.target.value)}
                                className={cn(
                                    "block w-full rounded-xl border shadow-sm text-sm p-3 outline-none transition-all appearance-none bg-white",
                                    "focus:border-[#C9A86C] focus:ring-1 focus:ring-[#C9A86C]/20",
                                    errors.category ? "border-red-400 bg-red-50/30" : "border-[#E8E2D9]"
                                )}
                                aria-invalid={!!errors.category}
                            >
                                <option value="">选择分类...</option>
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
                        </div>

                        {/* 价格 */}
                        <div>
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-1.5">
                                价格 <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0A89A] text-sm">¥</span>
                                <input
                                    type="text"
                                    value={formData.price}
                                    maxLength={MAX_PRICE_LENGTH}
                                    onChange={(e) => updateField("price", e.target.value)}
                                    className={cn(
                                        "block w-full rounded-xl border shadow-sm text-sm p-3 pl-7 outline-none transition-all bg-white",
                                        "focus:border-[#C9A86C] focus:ring-1 focus:ring-[#C9A86C]/20",
                                        errors.price ? "border-red-400 bg-red-50/30" : "border-[#E8E2D9]"
                                    )}
                                    placeholder="890"
                                    aria-invalid={!!errors.price}
                                />
                            </div>
                            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
                        </div>

                        {/* 开关组 */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-1.5">产品状态</label>
                            <div className="flex items-center gap-6 h-[46px]">
                                <Toggle label="上架状态" checked={formData.active} onChange={(v) => updateField("active", v)} />
                                <Toggle
                                    label="精选置顶"
                                    checked={formData.featured}
                                    onChange={(v) => updateField("featured", v)}
                                    tooltip="给该产品增加排序权重，使其在算法推荐中更容易排在前面。不勾选也会被算法自动推荐。"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-1.5">
                                产品描述 <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={3}
                                value={formData.description}
                                maxLength={MAX_DESCRIPTION_LENGTH}
                                onChange={(e) => updateField("description", e.target.value)}
                                placeholder="产品的核心卖点、适合人群..."
                                className={cn(
                                    "block w-full rounded-xl border shadow-sm text-sm p-3 outline-none resize-none transition-all bg-white",
                                    "focus:border-[#C9A86C] focus:ring-1 focus:ring-[#C9A86C]/20",
                                    errors.description ? "border-red-400 bg-red-50/30" : "border-[#E8E2D9]"
                                )}
                                aria-invalid={!!errors.description}
                            />
                            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-1.5">使用方法</label>
                            <textarea
                                rows={3}
                                value={formData.howToUse}
                                maxLength={MAX_HOW_TO_USE_LENGTH}
                                onChange={(e) => updateField("howToUse", e.target.value)}
                                placeholder="例：取适量于掌心，轻拍于面部..."
                                className="block w-full rounded-xl border border-[#E8E2D9] shadow-sm text-sm p-3 outline-none resize-none focus:border-[#C9A86C] focus:ring-1 focus:ring-[#C9A86C]/20 transition-all bg-white"
                            />
                        </div>
                    </div>
                </section>

                {/* ===== 产品图片 ===== */}
                <section>
                    <div>
                        <label className="block text-sm font-medium text-[#5E5E5E] mb-2">
                            上传图片 <span className="text-red-500">*</span>
                            <span className="text-xs text-[#B0A89A] font-normal ml-2">最多5张，第1张为封面，拖拽可调整顺序</span>
                        </label>

                        {/* 已上传图片缩略图 */}
                        {images.length > 0 && (
                            <div className="grid grid-cols-5 gap-2 mb-3">
                                {images.map((url, index) => (
                                    <div
                                        key={url}
                                        draggable
                                        onDragStart={() => setDraggingIndex(index)}
                                        onDragEnter={() => setDragOverIndex(index)}
                                        onDragOver={(e) => { e.preventDefault(); }}
                                        onDragLeave={() => setDragOverIndex(null)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (draggingIndex !== null) {
                                                moveImage(draggingIndex, index);
                                            }
                                            setDraggingIndex(null);
                                            setDragOverIndex(null);
                                        }}
                                        onDragEnd={() => {
                                            setDraggingIndex(null);
                                            setDragOverIndex(null);
                                        }}
                                        className={cn(
                                            "relative aspect-square rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all",
                                            index === 0 ? "border-[#C9A86C]" : "border-[#E8E2D9]",
                                            draggingIndex === index ? "opacity-40" : "",
                                            dragOverIndex === index && draggingIndex !== index ? "ring-2 ring-[#C9A86C] scale-105" : ""
                                        )}
                                    >
                                        <img src={url} className="w-full h-full object-cover pointer-events-none" alt="" />
                                        <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#2C2C2C]/40 text-white flex items-center justify-center">
                                            <GripVertical className="w-3 h-3" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#2C2C2C]/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                        {index === 0 && (
                                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#C9A86C] text-white">封面</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 上传区域 */}
                        {images.length < 5 && (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={onDrop}
                                className={cn(
                                    "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 cursor-pointer transition-all",
                                    dragOver ? "border-[#C9A86C] bg-[#FAF8F5]" : "border-[#E8E2D9] hover:border-[#C9A86C]/60 hover:bg-[#FAF8F5]/50",
                                    errors.image ? "border-red-400 bg-red-50/20" : ""
                                )}
                            >
                                <input ref={fileInputRef} type="file" className="sr-only" onChange={onFileChange} accept="image/jpeg,image/png,image/webp,image/gif" multiple />
                                <div className="text-center">
                                    {uploading ? (
                                        <Loader2 className="mx-auto h-8 w-8 text-[#D9D0C3] animate-spin" />
                                    ) : (
                                        <ImageIcon className="mx-auto h-8 w-8 text-[#D9D0C3]" />
                                    )}
                                    <p className="mt-2 text-sm font-medium text-[#5E5E5E]">
                                        {uploading ? "上传中..." : dragOver ? "松开以上传" : "点击或拖拽上传图片"}
                                    </p>
                                    <p className="mt-1 text-xs text-[#B0A89A]">
                                        支持 JPG、PNG、WebP、GIF，最大 10MB · 还可上传 {MAX_IMAGE_COUNT - images.length} 张
                                    </p>
                                </div>
                            </div>
                        )}
                        {errors.image && <p className="text-xs text-red-500 mt-1">{errors.image}</p>}
                    </div>
                </section>

                {/* ===== 成分与功效 ===== */}
                <section>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <TagInput label="核心成分" values={keyIngredients} onChange={setKeyIngredients} required error={errors.keyIngredients} placeholder="输入成分名称，按回车添加" />
                        <TagInput label="主要功效" values={benefits} onChange={setBenefits} required error={errors.benefits} placeholder="如：保湿、抗老、美白..." />
                        <TagInput label="不适合人群" values={negativeFor} onChange={setNegativeFor} placeholder="如：敏感肌、孕妇..." />
                    </div>
                </section>

                {/* ===== 肤质与电商 ===== */}
                <section>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-3">适用肤质</label>
                            <div className="flex flex-wrap gap-2">
                                {SKIN_TYPE_OPTIONS.map((opt) => {
                                    const selected = suitableSkinTypes.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                setSuitableSkinTypes((prev) =>
                                                    prev.includes(opt.value) ? prev.filter((v) => v !== opt.value) : [...prev, opt.value]
                                                );
                                            }}
                                            className={cn(
                                                "px-3.5 py-2 rounded-xl text-sm font-medium border transition-all",
                                                selected
                                                    ? "bg-[#C9A86C] text-white border-[#C9A86C] shadow-sm"
                                                    : "bg-white text-[#5E5E5E] border-[#E8E2D9] hover:border-[#C9A86C]/60"
                                            )}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                {selected && <Check className="w-3.5 h-3.5" />}
                                                {opt.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-3">电商购买链接</label>
                            <div className="space-y-3">
                                {[
                                    { key: "taobao", label: "天猫", icon: "🛒" },
                                    { key: "xiaohongshu", label: "小红书", icon: "📕" },
                                    { key: "douyin", label: "抖音", icon: "🎵" },
                                ].map(({ key, label, icon }) => (
                                    <div key={key} className="flex items-center gap-3">
                                        <span className="w-20 text-sm text-[#5E5E5E] flex items-center gap-1.5 shrink-0">
                                            <span>{icon}</span>
                                            {label}
                                        </span>
                                        <input
                                            type="url"
                                            value={affiliateLinks[key]}
                                            maxLength={500}
                                            onChange={(e) => setAffiliateLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                                            placeholder="https://..."
                                            className={cn(
                                                "flex-1 rounded-xl border shadow-sm text-sm p-2.5 outline-none transition-all bg-white",
                                                "focus:border-[#C9A86C] focus:ring-1 focus:ring-[#C9A86C]/20",
                                                errors[`affiliateLinks_${key}`] ? "border-red-400" : "border-[#E8E2D9]"
                                            )}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 底部操作栏 */}
                <div className="flex items-center justify-between pt-4 pb-2">
                    {!onCancel && (
                        <Link
                            href="/admin/products"
                            className="flex items-center gap-1.5 text-sm font-medium text-[#8B7355] hover:text-[#C9A86C] transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            返回产品列表
                        </Link>
                    )}
                    <div className={cn("flex items-center gap-3", onCancel && "ml-auto")}>
                        <button
                            type="button"
                            onClick={() => (onCancel ? onCancel() : router.back())}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#5E5E5E] bg-white border border-[#E8E2D9] hover:bg-[#FAF8F5] transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#C9A86C] hover:bg-[#B8975B] disabled:opacity-60 transition-colors shadow-sm"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {initialData?.id ? "保存修改" : "创建产品"}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
}
