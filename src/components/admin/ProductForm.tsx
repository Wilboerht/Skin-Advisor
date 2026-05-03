"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
    X, Plus, Loader2, Check, ChevronLeft,
    Sparkles, Link2, ImageIcon,
    Package
} from "lucide-react";
import { uploadImageToOSS } from "@/lib/oss-upload-client";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

// ==================== 常量配置 ====================

const CATEGORY_OPTIONS = [
    { value: "精华露", label: "精华露" },
    { value: "面霜", label: "面霜" },
    { value: "洁面", label: "洁面" },
    { value: "护理油", label: "护理油" },
    { value: "面膜", label: "面膜" },
    { value: "身体乳", label: "身体乳" },
    { value: "防晒", label: "防晒" },
    { value: "磨砂膏", label: "磨砂膏" },
    { value: "护手霜", label: "护手霜" },
];

const SKIN_TYPE_OPTIONS = [
    { value: "dry", label: "干性肌肤", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { value: "oily", label: "油性肌肤", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { value: "combination", label: "混合性肌肤", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { value: "combination_dry", label: "混干性肌肤", color: "bg-teal-50 text-teal-700 border-teal-200" },
    { value: "combination_oily", label: "混油性肌肤", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    { value: "sensitive", label: "敏感肌肤", color: "bg-rose-50 text-rose-700 border-rose-200" },
    { value: "normal", label: "中性肌肤", color: "bg-slate-50 text-slate-700 border-slate-200" },
];

// ==================== 子组件 ====================

/** Tag 输入组件 */
function TagInput({ label, values, onChange, required = false, error, placeholder = "添加..." }: {
    label: string; values: string[]; onChange: (vals: string[]) => void;
    required?: boolean; error?: string; placeholder?: string;
}) {
    const [input, setInput] = useState("");
    const addTag = () => {
        const trimmed = input.trim();
        if (trimmed && !values.includes(trimmed)) {
            onChange([...values, trimmed]);
            setInput("");
        }
    };
    const removeTag = (i: number) => onChange(values.filter((_, idx) => idx !== i));

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
                {label}{required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="flex flex-wrap gap-2 min-h-[42px] p-2 rounded-xl border border-slate-200 bg-white focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 transition-all">
                {values.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-sm font-medium text-slate-800">
                        {tag}
                        <button type="button" onClick={() => removeTag(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <div className="flex items-center flex-1 min-w-[80px]">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                        onBlur={addTag}
                        className="w-full text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent py-1"
                        placeholder={values.length === 0 ? placeholder : ""}
                    />
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
                    checked ? "bg-slate-900" : "bg-slate-200"
                )}>
                    <div className={cn(
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200",
                        checked ? "translate-x-5" : "translate-x-0"
                    )} />
                </div>
                <span className="text-sm font-medium text-slate-700">{label}</span>
            </button>
            {tooltip && (
                <div className="relative">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 cursor-help">?</span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                        {tooltip}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                    </div>
                </div>
            )}
        </div>
    );
}

/** 步骤导航 */
function StepNav({ steps, activeStep, onStepClick }: {
    steps: { id: string; label: string; icon: React.ElementType }[];
    activeStep: string;
    onStepClick: (id: string) => void;
}) {
    return (
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl">
            {steps.map((step) => {
                const Icon = step.icon;
                const isActive = activeStep === step.id;
                return (
                    <button
                        key={step.id}
                        type="button"
                        onClick={() => onStepClick(step.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                            isActive
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        {step.label}
                    </button>
                );
            })}
        </div>
    );
}

/** 表单区块标题 */
function SectionCard({ id, title, icon: Icon, children, className }: {
    id: string; title: string; icon: React.ElementType;
    children: React.ReactNode; className?: string;
}) {
    return (
        <div id={id} className={cn("bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden", className)}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-slate-900">{title}</h2>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    );
}

// ==================== 表单主体 ====================

type FormErrors = Record<string, string>;

function validate(formData: any, keyIngredients: string[], benefits: string[], images: string[]) {
    const errors: FormErrors = {};
    if (!formData.name?.trim()) errors.name = "产品名称为必填";
    if (!formData.category) errors.category = "分类为必填";
    if (!formData.price?.trim()) errors.price = "价格为必填";
    if (!formData.description?.trim()) errors.description = "描述为必填";
    if (images.length === 0) errors.image = "请上传产品图片";

    if (!keyIngredients.length) errors.keyIngredients = "请填写核心成分";
    if (!benefits.length) errors.benefits = "请填写主要功效";
    return errors;
}

const STEPS = [
    { id: "basic", label: "基础信息", icon: Package },
    { id: "ingredients", label: "成分功效", icon: Sparkles },
    { id: "links", label: "肤质电商", icon: Link2 },
];

export default function ProductForm({ initialData }: { initialData?: any }) {
    const router = useRouter();
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [activeStep, setActiveStep] = useState("basic");
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

    const [affiliateLinks, setAffiliateLinks] = useState({
        taobao: initialData?.affiliateLinks?.taobao || "",
        xiaohongshu: initialData?.affiliateLinks?.xiaohongshu || "",
        douyin: initialData?.affiliateLinks?.douyin || "",
    });

    const [keyIngredients, setKeyIngredients] = useState<string[]>(initialData?.keyIngredients || []);
    const [benefits, setBenefits] = useState<string[]>(initialData?.benefits || []);
    const [negativeFor, setNegativeFor] = useState<string[]>(initialData?.negativeFor || []);
    const [suitableSkinTypes, setSuitableSkinTypes] = useState<string[]>(initialData?.suitableSkinTypes || []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // 滚动监听更新当前步骤
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveStep(entry.target.id.replace("section-", ""));
                    }
                });
            },
            { rootMargin: "-40% 0px -50% 0px" }
        );
        STEPS.forEach((s) => {
            const el = document.getElementById(`section-${s.id}`);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);

    const handleImageUpload = async (file: File) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error("图片不能超过2MB");
            return;
        }
        setUploading(true);
        try {
            const url = await uploadImageToOSS(file);
            setImages((prev) => [...prev, url]);
            toast.success("图片上传成功");
        } catch {
            toast.error("上传失败");
        } finally {
            setUploading(false);
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const remaining = 5 - images.length;
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
        const remaining = 5 - images.length;
        const toUpload = files.slice(0, remaining);
        toUpload.forEach((file) => handleImageUpload(file));
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const scrollToStep = (id: string) => {
        const el = document.getElementById(`section-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            setActiveStep(id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors = validate(formData, keyIngredients, benefits, images);
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            // 滚动到第一个错误
            const firstErr = document.querySelector("[aria-invalid='true']");
            firstErr?.scrollIntoView({ behavior: "smooth", block: "center" });
            toast.error("请完善必填项");
            return;
        }
        setSaving(true);

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
            if (!res.ok) throw new Error("保存失败");
            toast.success(initialData?.id ? "产品已更新" : "产品已创建");
            router.push("/admin/products");
            router.refresh();
        } catch {
            toast.error("保存产品时出错");
        } finally {
            setSaving(false);
        }
    };

    const updateField = useCallback(<K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }, [errors]);

    // 预览数据
    const previewData = useMemo(() => ({
        id: "preview",
        name: formData.name || "产品名称",
        category: formData.category || "分类",
        image: images[0] || "",
        price: String(formData.price) || "¥0",
        reason: formData.description || "产品描述",
        matchScore: 92,
        keyIngredients,
        benefits,
        howToUse: formData.howToUse || null,
        affiliateLinks: Object.entries(affiliateLinks).filter(([, v]) => v.trim()).length > 0 ? affiliateLinks : null,
    }), [formData, keyIngredients, benefits, affiliateLinks]);

    return (
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
            {/* ===== 左侧表单 ===== */}
            <div className="flex-1 min-w-0 space-y-6">
                {/* 步骤导航 */}
                <div className="sticky top-0 z-30 bg-[#F9FAFB] pt-2 pb-3">
                    <StepNav steps={STEPS} activeStep={activeStep} onStepClick={scrollToStep} />
                </div>

                {/* 步骤1：基础信息 */}
                <SectionCard id="section-basic" title="基础信息" icon={Package}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* 产品名称 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                产品名称 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => updateField("name", e.target.value)}
                                className={cn(
                                    "block w-full rounded-xl border shadow-sm text-sm p-3 outline-none transition-all",
                                    "focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                                    errors.name ? "border-red-400 bg-red-50/30" : "border-slate-200 bg-white"
                                )}
                                placeholder="如：NIHPLOD 玻色因面霜"
                                aria-invalid={!!errors.name}
                            />
                            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                        </div>

                        {/* 分类 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                分类 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => updateField("category", e.target.value)}
                                className={cn(
                                    "block w-full rounded-xl border shadow-sm text-sm p-3 outline-none transition-all appearance-none bg-white",
                                    "focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                                    errors.category ? "border-red-400 bg-red-50/30" : "border-slate-200"
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
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                价格 <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                                <input
                                    type="text"
                                    value={formData.price}
                                    onChange={(e) => updateField("price", e.target.value)}
                                    className={cn(
                                        "block w-full rounded-xl border shadow-sm text-sm p-3 pl-7 outline-none transition-all",
                                        "focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                                        errors.price ? "border-red-400 bg-red-50/30" : "border-slate-200 bg-white"
                                    )}
                                    placeholder="890"
                                    aria-invalid={!!errors.price}
                                />
                            </div>
                            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
                        </div>

                            {/* 开关组 */}
                        <div className="flex items-center gap-6">
                            <Toggle label="上架状态" checked={formData.active} onChange={(v) => updateField("active", v)} />
                            <Toggle
                                label="精选置顶"
                                checked={formData.featured}
                                onChange={(v) => updateField("featured", v)}
                                tooltip="给该产品增加排序权重，使其在算法推荐中更容易排在前面。不勾选也会被算法自动推荐。"
                            />
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">使用方法</label>
                            <textarea
                                rows={3}
                                value={formData.howToUse}
                                onChange={(e) => updateField("howToUse", e.target.value)}
                                placeholder="例：取适量于掌心，轻拍于面部..."
                                className="block w-full rounded-xl border border-slate-200 shadow-sm text-sm p-3 outline-none resize-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                产品描述 <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={3}
                                value={formData.description}
                                onChange={(e) => updateField("description", e.target.value)}
                                placeholder="产品的核心卖点、适合人群..."
                                className={cn(
                                    "block w-full rounded-xl border shadow-sm text-sm p-3 outline-none resize-none transition-all",
                                    "focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                                    errors.description ? "border-red-400 bg-red-50/30" : "border-slate-200"
                                )}
                                aria-invalid={!!errors.description}
                            />
                            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
                        </div>
                    </div>
                </SectionCard>

                {/* 步骤2：成分与功效 */}
                <SectionCard id="section-ingredients" title="成分与功效" icon={Sparkles}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 图片上传 */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                产品图片 <span className="text-red-500">*</span>
                                <span className="text-xs text-slate-400 font-normal ml-2">最多5张，第1张为封面</span>
                            </label>

                            {/* 已上传图片缩略图 */}
                            {images.length > 0 && (
                                <div className="grid grid-cols-5 gap-2 mb-3">
                                    {images.map((url, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "relative aspect-square rounded-xl overflow-hidden border-2",
                                                index === 0 ? "border-slate-900" : "border-slate-200"
                                            )}
                                        >
                                            <img src={url} className="w-full h-full object-cover" alt="" />
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                            {index === 0 && (
                                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white">封面</span>
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
                                        "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-6 cursor-pointer transition-all",
                                        dragOver ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-400 hover:bg-slate-50/50",
                                        errors.image ? "border-red-400 bg-red-50/20" : ""
                                    )}
                                >
                                    <input ref={fileInputRef} type="file" className="sr-only" onChange={onFileChange} accept="image/*" multiple />
                                    <div className="text-center">
                                        {uploading ? (
                                            <Loader2 className="mx-auto h-8 w-8 text-slate-300 animate-spin" />
                                        ) : (
                                            <ImageIcon className="mx-auto h-8 w-8 text-slate-300" />
                                        )}
                                        <p className="mt-2 text-sm font-medium text-slate-700">
                                            {uploading ? "上传中..." : dragOver ? "松开以上传" : "点击或拖拽上传图片"}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            支持 JPG、PNG，最大 2MB · 还可上传 {5 - images.length} 张
                                        </p>
                                    </div>
                                </div>
                            )}
                            {errors.image && <p className="text-xs text-red-500 mt-1">{errors.image}</p>}
                        </div>

                        {/* 标签组 */}
                        <div className="flex flex-col gap-5">
                            <TagInput label="核心成分" values={keyIngredients} onChange={setKeyIngredients} required error={errors.keyIngredients} placeholder="输入成分名称，按回车添加" />
                            <TagInput label="主要功效" values={benefits} onChange={setBenefits} required error={errors.benefits} placeholder="如：保湿、抗老、美白..." />
                            <TagInput label="不适合人群 / 负面标签" values={negativeFor} onChange={setNegativeFor} placeholder="如：敏感肌、孕妇..." />
                        </div>
                    </div>
                </SectionCard>

                {/* 步骤3：肤质与电商 */}
                <SectionCard id="section-links" title="适用肤质 & 电商信息" icon={Link2}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">适用肤质</label>
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
                                                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
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
                            <label className="block text-sm font-medium text-slate-700 mb-3">电商购买链接</label>
                            <div className="space-y-3">
                                {[
                                    { key: "taobao", label: "天猫", icon: "🛒" },
                                    { key: "xiaohongshu", label: "小红书", icon: "📕" },
                                    { key: "douyin", label: "抖音", icon: "🎵" },
                                ].map(({ key, label, icon }) => (
                                    <div key={key} className="flex items-center gap-3">
                                        <span className="w-20 text-sm text-slate-600 flex items-center gap-1.5 shrink-0">
                                            <span>{icon}</span>
                                            {label}
                                        </span>
                                        <input
                                            type="url"
                                            value={affiliateLinks[key as keyof typeof affiliateLinks]}
                                            onChange={(e) => setAffiliateLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                                            placeholder="https://..."
                                            className={cn(
                                                "flex-1 rounded-xl border shadow-sm text-sm p-2.5 outline-none transition-all",
                                                "focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                                                errors[`affiliateLinks_${key}`] ? "border-red-400" : "border-slate-200"
                                            )}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* 底部操作栏 */}
                <div className="flex items-center justify-between pt-2 pb-8">
                    <Link
                        href="/admin/products"
                        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        返回产品列表
                    </Link>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 transition-colors shadow-sm"
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
