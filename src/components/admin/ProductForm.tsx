
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, X, Plus, Loader2 } from "lucide-react";
import { uploadImageToOSS } from "@/lib/oss-upload-client";
import { IngredientSelector } from "./IngredientSelector";
import { STAR_INGREDIENTS } from "@/config/ingredients";
import { useToast } from "@/components/ui/Toast";

// Simple Tag Input Component
function TagInput({
    label,
    values,
    onChange
}: {
    label: string;
    values: string[];
    onChange: (vals: string[]) => void
}) {
    const [input, setInput] = useState("");

    const addTag = () => {
        if (input.trim()) {
            onChange([...values, input.trim()]);
            setInput("");
        }
    };

    const removeTag = (index: number) => {
        onChange(values.filter((_, i) => i !== index));
    };

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700">{label}</label>
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
                    />
                    <button type="button" onClick={addTag} className="ml-2 p-1 text-slate-500 hover:text-slate-900">
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
            </div>
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

export default function ProductForm({ initialData }: { initialData?: any }) {
    const router = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
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
        setLoading(true);

        // 过滤空的电商链接
        const filteredLinks: Record<string, string> = {};
        Object.entries(affiliateLinks).forEach(([key, value]) => {
            if (value.trim()) filteredLinks[key] = value.trim();
        });

        // 将成分 ID 转换为保存格式（ID 列表）
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
        <form onSubmit={handleSubmit} className="space-y-8 bg-white/40 backdrop-blur-3xl p-10 rounded-[32px] shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.5)] border-[1.5px] border-white/60 animate-in fade-in zoom-in-95 duration-1000">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Basic Info */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">产品名称</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">英文名称</label>
                        <input
                            type="text"
                            value={formData.nameEn}
                            onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">分类</label>
                            <input
                                required
                                type="text"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">价格</label>
                            <input
                                required
                                type="text"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">库存</label>
                            <input
                                required
                                type="number"
                                min="0"
                                value={formData.stock}
                                onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                                className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">护肤步骤</label>
                            <select
                                value={formData.step}
                                onChange={e => setFormData({ ...formData, step: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border bg-white"
                            >
                                <option value="">选择步骤...</option>
                                {STEP_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">使用方法</label>
                        <textarea
                            rows={2}
                            value={formData.howToUse}
                            onChange={e => setFormData({ ...formData, howToUse: e.target.value })}
                            placeholder="例：取适量于掌心，轻拍于面部..."
                            className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">产品描述</label>
                        <textarea
                            required
                            rows={4}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                        />
                    </div>


                </div>

                {/* Image & Tags */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">产品图片</label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-2 flex justify-center rounded-lg border border-dashed border-slate-300 px-6 py-10 cursor-pointer hover:bg-slate-50"
                        >
                            <div className="text-center">
                                {formData.image ? (
                                    <div className="relative h-48 w-full">
                                        <img src={formData.image} className="mx-auto h-48 object-contain" alt="Preview" />
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
                            </div>
                        </div>
                    </div>

                    <IngredientSelector selectedIds={keyIngredientIds} onChange={setKeyIngredientIds} />
                    <TagInput label="Benefits" values={benefits} onChange={setBenefits} />
                    <TagInput label="不适合人群 / 负面标签" values={negativeFor} onChange={setNegativeFor} />

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
                                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 电商链接 */}
                    <div className="pt-4 border-t border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-3">电商购买链接</label>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="w-20 text-sm text-slate-600">🛒 淘宝</span>
                                <input
                                    type="url"
                                    value={affiliateLinks.taobao}
                                    onChange={e => setAffiliateLinks({ ...affiliateLinks, taobao: e.target.value })}
                                    placeholder="https://..."
                                    className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-20 text-sm text-slate-600">📦 京东</span>
                                <input
                                    type="url"
                                    value={affiliateLinks.jd}
                                    onChange={e => setAffiliateLinks({ ...affiliateLinks, jd: e.target.value })}
                                    placeholder="https://..."
                                    className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-20 text-sm text-slate-600">📕 小红书</span>
                                <input
                                    type="url"
                                    value={affiliateLinks.xiaohongshu}
                                    onChange={e => setAffiliateLinks({ ...affiliateLinks, xiaohongshu: e.target.value })}
                                    placeholder="https://..."
                                    className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-20 text-sm text-slate-600">🎵 抖音</span>
                                <input
                                    type="url"
                                    value={affiliateLinks.douyin}
                                    onChange={e => setAffiliateLinks({ ...affiliateLinks, douyin: e.target.value })}
                                    placeholder="https://..."
                                    className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end border-t pt-6">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="mr-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                >
                    取消
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-70"
                >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    保存产品
                </button>
            </div>
        </form>
    );
}
