
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, X, Plus, Loader2 } from "lucide-react";
import { uploadImageToOSS } from "@/lib/oss-upload-client";

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
                        placeholder="Add..."
                    />
                    <button type="button" onClick={addTag} className="ml-2 p-1 text-slate-500 hover:text-slate-900">
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ProductForm({ initialData }: { initialData?: any }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        nameEn: initialData?.nameEn || "",
        category: initialData?.category || "",
        price: initialData?.price || "",
        description: initialData?.description || "",
        image: initialData?.image || "",
    });

    const [keyIngredients, setKeyIngredients] = useState<string[]>(initialData?.keyIngredients || []);
    const [benefits, setBenefits] = useState<string[]>(initialData?.benefits || []);
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
            alert("Upload failed");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            ...formData,
            keyIngredients,
            benefits,
            suitableSkinTypes,
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

            if (!res.ok) throw new Error("Failed to save");

            router.push("/admin/products");
            router.refresh();
        } catch (err) {
            alert("Error saving product");
        } finally {
            setLoading(false);
        }
    };

    const skinTypeOptions = [
        { value: "dry", label: "Dry" },
        { value: "oily", label: "Oily" },
        { value: "combination", label: "Combination" },
        { value: "sensitive", label: "Sensitive" },
        { value: "aging", label: "Aging" },
        { value: "all", label: "All Types" },
    ];

    const handleSkinTypeToggle = (type: string) => {
        if (suitableSkinTypes.includes(type)) {
            setSuitableSkinTypes(prev => prev.filter(t => t !== type));
        } else {
            setSuitableSkinTypes(prev => [...prev, type]);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Basic Info */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Product Name</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">English Name</label>
                        <input
                            type="text"
                            value={formData.nameEn}
                            onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                            className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Category</label>
                            <input
                                required
                                type="text"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Price</label>
                            <input
                                required
                                type="text"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 sm:text-sm p-2 border"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Description</label>
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
                        <label className="block text-sm font-medium text-slate-700">Product Image</label>
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
                                        {formData.image ? "Change Image" : "Upload a file"}
                                    </span>
                                    <input ref={fileInputRef} type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <TagInput label="Key Ingredients" values={keyIngredients} onChange={setKeyIngredients} />
                    <TagInput label="Benefits" values={benefits} onChange={setBenefits} />

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Suitable Skin Types</label>
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
                </div>
            </div>

            <div className="flex justify-end border-t pt-6">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="mr-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-70"
                >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Product
                </button>
            </div>
        </form>
    );
}
