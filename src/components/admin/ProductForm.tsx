
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, X, Plus, Loader2 } from "lucide-react";
import { uploadImageToOSS } from "@/lib/oss-upload-client";
import { IngredientSelector } from "./IngredientSelector";
import { STAR_INGREDIENTS } from "@/config/ingredients";
import { useToast } from "@/components/ui/Toast";

// Tag Input with error and required
function TagInput({ label, values, onChange, required = false, error }: { label: string; values: string[]; onChange: (vals: string[]) => void; required?: boolean; error?: string }) {
    const [input, setInput] = useState("");
    const addTag = () => {
        if (input.trim() && !values.includes(input.trim())) {
            onChange([...values, input.trim()]);
            setInput("");
        }
    };
    const removeTag = (index: number) => {
        onChange(values.filter((_, i) => i !== index));
    };
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700">
                {label}{required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
                {values.map((tag, i) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">
                        {tag}
                        <button type="button" onClick={() => removeTag(i)} className="ml-2 text-slate-500 hover:text-slate-700">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <div className="flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                        className="block w-32 rounded-lg border-0 py-1 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-slate-900"
                        placeholder="添加..."
                        aria-invalid={!!error}
                    />
                    <button type="button" onClick={addTag} className="ml-2 p-1 text-slate-500 hover:text-slate-900">
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
            </div>
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
        </div>
    );
}

// 护肤步骤选项
const STEP_OPTIONS = [
    { value: 'cleanser', label: '洁面' },
    { value: 'toner', label: '化妆水' },
    { value: 'essence', label: '精华液' },
    { value: 'serum', label: '精华' },
    { value: 'eye_cream', label: '眼霜' },
    { value: 'cream', label: '面霜' },
    { value: 'sunscreen', label: '防晒' },
    { value: 'mask', label: '面膜' },
    { value: 'oil', label: '护肤油' },
    { value: 'other', label: '其他' },
];

// 表单数据类型
type ProductFormData = {
    name: string;
    nameEn?: string;
    category: string;
    price: string | number;
    description: string;
    image: string;
    stock: number;
    step?: string;
    howToUse?: string;
    [key: string]: any;
};

// 字段校验
function validate(formData: ProductFormData, keyIngredientIds: string[], benefits: string[]) {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = "产品名称为必填";
    if (!formData.category) errors.category = "分类为必填";
    if (!formData.price) errors.price = "价格为必填";
    if (!formData.description) errors.description = "描述为必填";
    if (!formData.image) errors.image = "请上传产品图片";
    if (formData.stock === undefined || formData.stock === null || formData.stock < 0) errors.stock = "库存需为非负数";
    if (!keyIngredientIds.length) errors.keyIngredients = "请选择核心成分";
    if (!benefits.length) errors.benefits = "请填写主要功效";
    return errors;
}

export default function ProductForm({ initialData }: { initialData?: any }) {
    const router = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        nameEn: initialData?.nameEn || "",
        category: initialData?.category || "",
        price: initialData?.price || "",
        description: initialData?.description || "",
        image: initialData?.image || "",
        stock: initialData?.stock || 0,
        step: initialData?.step || "",
        howToUse: initialData?.howToUse || "",
    });

    // 电商链接
    const [affiliateLinks, setAffiliateLinks] = useState({
        taobao: initialData?.affiliateLinks?.taobao || "",
        jd: initialData?.affiliateLinks?.jd || "",
        xiaohongshu: initialData?.affiliateLinks?.xiaohongshu || "",
        douyin: initialData?.affiliateLinks?.douyin || "",
    });

    // keyIngredients 现在存储成分 ID 列表
    const [keyIngredientIds, setKeyIngredientIds] = useState<string[]>(
        // 兼容旧数据：如果 initialData 是字符串名称，尝试转换为 ID
        (initialData?.keyIngredients || []).map((item: string) => {
            const found = STAR_INGREDIENTS.find(i => i.id === item || i.name === item);
            return found?.id || item;
        })
    );
    const [benefits, setBenefits] = useState<string[]>(initialData?.benefits || []);
    const [negativeFor, setNegativeFor] = useState<string[]>(initialData?.negativeFor || []);
    const [suitableSkinTypes, setSuitableSkinTypes] = useState<string[]>(initialData?.suitableSkinTypes || []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            // 限制图片大小 2MB
            if (file.size > 2 * 1024 * 1024) {
                toast.error("图片不能超过2MB");
                setLoading(false);
                return;
            }
            const url = await uploadImageToOSS(file);
            setFormData(prev => ({ ...prev, image: url }));
        } catch (err) {
            toast.error("上传失败");
        } finally {
            setLoading(false);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // 前端校验
        const newErrors = validate(formData, keyIngredientIds, benefits);
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            toast.error("请完善必填项");
            return;
        }
        setLoading(true);
        // 过滤空的电商链接
        const filteredLinks: Record<string, string> = {};
        Object.entries(affiliateLinks).forEach(([key, value]) => {
            if (value.trim()) filteredLinks[key] = value.trim();
        });
        // 校验电商链接格式
        for (const [k, v] of Object.entries(filteredLinks)) {
            if (!/^https?:\/\//.test(v)) {
                setErrors(errs => ({ ...errs, [`affiliateLinks_${k}`]: "请输入有效链接" }));
                toast.error("请填写有效的电商链接");
                setLoading(false);
                return;
            }
        }
        const payload = {
            ...formData,
            keyIngredients: keyIngredientIds,
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
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("保存失败");
            toast.success(initialData?.id ? "产品已更新" : "产品已创建");
            router.push("/admin/products");
            router.refresh();
        } catch (err) {
            toast.error("保存产品时出错");
        } finally {
            setLoading(false);
        }
    };

    const skinTypeOptions = [
        { value: "dry", label: "干性" },
        { value: "oily", label: "油性" },
        { value: "combination", label: "混合性" },
        { value: "sensitive", label: "敏感性" },
        { value: "aging", label: "衰老/皱纹" },
        { value: "all", label: "所有肤质" },
    ];

    const handleSkinTypeToggle = (type: string) => {
        if (suitableSkinTypes.includes(type)) {
            setSuitableSkinTypes(prev => prev.filter(t => t !== type));
        } else {
            setSuitableSkinTypes(prev => [...prev, type]);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8 p-0">
            {/* 卡片1：基础信息 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-4 border border-slate-100">
                <h2 className="text-lg font-bold mb-6 text-slate-900">基础信息</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">产品名称<span className="text-red-500 ml-1">*</span></label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className={`mt-1 block w-full rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border ${errors.name ? 'border-red-500' : ''}`}
                            aria-invalid={!!errors.name}
                        />
                        {errors.name && <div className="text-xs text-red-500 mt-1">{errors.name}</div>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">英文名称</label>
                        <input
                            type="text"
                            value={formData.nameEn}
                            onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                            className="mt-1 block w-full rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">分类<span className="text-red-500 ml-1">*</span></label>
                        <input
                            required
                            type="text"
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                            className={`mt-1 block w-full rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border ${errors.category ? 'border-red-500' : ''}`}
                            aria-invalid={!!errors.category}
                        />
                        {errors.category && <div className="text-xs text-red-500 mt-1">{errors.category}</div>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">价格<span className="text-red-500 ml-1">*</span></label>
                        <input
                            required
                            type="text"
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                            className={`mt-1 block w-full rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border ${errors.price ? 'border-red-500' : ''}`}
                            aria-invalid={!!errors.price}
                        />
                        {errors.price && <div className="text-xs text-red-500 mt-1">{errors.price}</div>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">库存<span className="text-red-500 ml-1">*</span></label>
                        <input
                            required
                            type="number"
                            min="0"
                            value={formData.stock}
                            onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                            className={`mt-1 block w-full rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border ${errors.stock ? 'border-red-500' : ''}`}
                            aria-invalid={!!errors.stock}
                        />
                        {errors.stock && <div className="text-xs text-red-500 mt-1">{errors.stock}</div>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">护肤步骤</label>
                        <select
                            value={formData.step}
                            onChange={e => setFormData({ ...formData, step: e.target.value })}
                            className="mt-1 block w-full rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border bg-white"
                        >
                            <option value="">选择步骤...</option>
                            {STEP_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">使用方法</label>
                        <textarea
                            rows={2}
                            value={formData.howToUse}
                            onChange={e => setFormData({ ...formData, howToUse: e.target.value })}
                            placeholder="例：取适量于掌心，轻拍于面部..."
                            className="mt-1 block w-full rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">产品描述<span className="text-red-500 ml-1">*</span></label>
                        <textarea
                            required
                            rows={4}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="mt-1 block w-full rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border"
                        />
                    </div>
                </div>
            </div>

            {/* 卡片2：图片与成分功效 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-4 border border-slate-100">
                <h2 className="text-lg font-bold mb-6 text-slate-900">成分与功效</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">产品图片<span className="text-red-500 ml-1">*</span></label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`mt-2 flex justify-center rounded-xl border border-dashed px-6 py-10 cursor-pointer hover:bg-slate-50 ${errors.image ? 'border-red-500' : 'border-slate-200'}`}
                        >
                            <div className="text-center">
                                {formData.image ? (
                                    <div className="relative h-40 w-full">
                                        <img src={formData.image} className="mx-auto h-40 object-contain" alt="Preview" />
                                    </div>
                                ) : (
                                    <Upload className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
                                )}
                                <div className="mt-4 flex text-sm leading-6 text-slate-600 justify-center">
                                    <span className="relative rounded-md bg-white font-semibold text-slate-900 focus-within:outline-none focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-2 hover:text-slate-700">
                                        {formData.image ? "更换图片" : "上传文件"}
                                    </span>
                                    <input ref={fileInputRef} type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                                </div>
                                {errors.image && <div className="text-xs text-red-500 mt-1">{errors.image}</div>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-6">
                        <IngredientSelector selectedIds={keyIngredientIds} onChange={setKeyIngredientIds} error={errors.keyIngredients} />
                        <TagInput label="主要功效" values={benefits} onChange={setBenefits} required error={errors.benefits} />
                        <TagInput label="不适合人群 / 负面标签" values={negativeFor} onChange={setNegativeFor} />
                    </div>
                </div>
            </div>

            {/* 卡片3：适用肤质与电商 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-4 border border-slate-100">
                <h2 className="text-lg font-bold mb-6 text-slate-900">适用肤质 & 电商信息</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">适用肤质</label>
                        <div className="flex flex-wrap gap-2">
                            {skinTypeOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSkinTypeToggle(opt.value)}
                                    className={`px-3 py-1 rounded-full text-sm font-medium border ${suitableSkinTypes.includes(opt.value)
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">电商购买链接</label>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="w-20 text-sm text-slate-600">🛒 淘宝</span>
                                <input
                                    type="url"
                                    value={affiliateLinks.taobao}
                                    onChange={e => setAffiliateLinks({ ...affiliateLinks, taobao: e.target.value })}
                                    placeholder="https://..."
                                    className={`flex-1 rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border ${errors.affiliateLinks_taobao ? 'border-red-500' : ''}`}
                                    aria-invalid={!!errors.affiliateLinks_taobao}
                                />
                                {errors.affiliateLinks_taobao && <div className="text-xs text-red-500 ml-1">{errors.affiliateLinks_taobao}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-20 text-sm text-slate-600">📦 京东</span>
                                <input
                                    type="url"
                                    value={affiliateLinks.jd}
                                    onChange={e => setAffiliateLinks({ ...affiliateLinks, jd: e.target.value })}
                                    placeholder="https://..."
                                    className={`flex-1 rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border ${errors.affiliateLinks_jd ? 'border-red-500' : ''}`}
                                    aria-invalid={!!errors.affiliateLinks_jd}
                                />
                                {errors.affiliateLinks_jd && <div className="text-xs text-red-500 ml-1">{errors.affiliateLinks_jd}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-20 text-sm text-slate-600">📕 小红书</span>
                                <input
                                    type="url"
                                    value={affiliateLinks.xiaohongshu}
                                    onChange={e => setAffiliateLinks({ ...affiliateLinks, xiaohongshu: e.target.value })}
                                    placeholder="https://..."
                                    className={`flex-1 rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border ${errors.affiliateLinks_xiaohongshu ? 'border-red-500' : ''}`}
                                    aria-invalid={!!errors.affiliateLinks_xiaohongshu}
                                />
                                {errors.affiliateLinks_xiaohongshu && <div className="text-xs text-red-500 ml-1">{errors.affiliateLinks_xiaohongshu}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-20 text-sm text-slate-600">🎵 抖音</span>
                                <input
                                    type="url"
                                    value={affiliateLinks.douyin}
                                    onChange={e => setAffiliateLinks({ ...affiliateLinks, douyin: e.target.value })}
                                    placeholder="https://..."
                                    className={`flex-1 rounded-xl border-slate-200 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-3 border ${errors.affiliateLinks_douyin ? 'border-red-500' : ''}`}
                                    aria-invalid={!!errors.affiliateLinks_douyin}
                                />
                                {errors.affiliateLinks_douyin && <div className="text-xs text-red-500 ml-1">{errors.affiliateLinks_douyin}</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-4 pt-2">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                >
                    取消
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-70"
                >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    保存产品
                </button>
            </div>
        </form>
    );
}
