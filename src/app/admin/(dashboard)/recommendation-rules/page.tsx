"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, Trash2, Plus, Sparkles, X, Pencil, Check
} from "lucide-react";

interface Product {
    id: string;
    name: string;
    category: string;
}

interface RecommendationRule {
    id: string;
    name: string;
    priority: number;
    conditions: Record<string, unknown>;
    message: string | null;
    active: boolean;
    productIds: string[];
    createdAt: string;
}

const SKIN_TYPES = ["dry", "oily", "combination", "sensitive", "normal"];
const CONCERNS = ["acne", "wrinkles", "dark spots", "redness", "pores", "dullness", "blackheads", "dryness"];
const PERSONAS = [
    { value: "sensitive", label: "敏敏派" },
    { value: "minimalist", label: "极简派" },
    { value: "luxury", label: "奢华派" },
    { value: "ageless", label: "冻龄派" },
    { value: "desert", label: "沙漠派" },
    { value: "oily", label: "油条派" },
    { value: "combination", label: "混合派" },
    { value: "guardian", label: "守护派" },
];

export default function RecommendationRulesPage() {
    const [rules, setRules] = useState<RecommendationRule[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState<RecommendationRule | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formName, setFormName] = useState("");
    const [formPriority, setFormPriority] = useState(0);
    const [formMessage, setFormMessage] = useState("");
    const [formActive, setFormActive] = useState(true);
    const [selectedSkinTypes, setSelectedSkinTypes] = useState<string[]>([]);
    const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
    const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

    const fetchRules = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/recommendation-rules");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setRules(data);
        } catch {
        }
    }, []);

    const fetchProducts = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/products?limit=500");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setProducts(data.products || []);
        } catch {
            // Silent fail
        }
    }, []);

    useEffect(() => {
        Promise.all([fetchRules(), fetchProducts()]).finally(() => setLoading(false));
    }, [fetchRules, fetchProducts]);

    const resetForm = () => {
        setFormName("");
        setFormPriority(0);
        setFormMessage("");
        setFormActive(true);
        setSelectedSkinTypes([]);
        setSelectedConcerns([]);
        setSelectedPersonas([]);
        setSelectedProductIds([]);
        setEditingRule(null);
    };

    const openCreate = () => {
        resetForm();
        setShowModal(true);
    };

    const openEdit = (rule: RecommendationRule) => {
        setEditingRule(rule);
        setFormName(rule.name);
        setFormPriority(rule.priority);
        setFormMessage(rule.message || "");
        setFormActive(rule.active);
        const cond = rule.conditions as { skinType?: string[]; concern?: string[]; persona?: string[] };
        setSelectedSkinTypes(cond.skinType || []);
        setSelectedConcerns(cond.concern || []);
        setSelectedPersonas(cond.persona || []);
        setSelectedProductIds(rule.productIds || []);
        setShowModal(true);
    };

    const toggleSelection = (value: string, list: string[], setList: (v: string[]) => void) => {
        if (list.includes(value)) {
            setList(list.filter(v => v !== value));
        } else {
            setList([...list, value]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            return;
        }
        if (selectedSkinTypes.length === 0 && selectedConcerns.length === 0 && selectedPersonas.length === 0) {
            return;
        }

        setSubmitting(true);
        try {
            const body = {
                name: formName.trim(),
                priority: Number(formPriority),
                conditions: {
                    ...(selectedSkinTypes.length > 0 && { skinType: selectedSkinTypes }),
                    ...(selectedConcerns.length > 0 && { concern: selectedConcerns }),
                    ...(selectedPersonas.length > 0 && { persona: selectedPersonas }),
                },
                message: formMessage.trim() || undefined,
                active: formActive,
                productIds: selectedProductIds,
            };

            if (editingRule) {
                const res = await fetch(`/api/admin/recommendation-rules/${editingRule.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || "更新失败");
                }
            } else {
                const res = await fetch("/api/admin/recommendation-rules", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || "创建失败");
                }
            }
            setShowModal(false);
            resetForm();
            fetchRules();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "操作失败";
            alert(message);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (id: string, active: boolean) => {
        const previousRules = rules;
        // 乐观更新
        setRules(prev => prev.map(r => r.id === id ? { ...r, active: !active } : r));
        try {
            const res = await fetch(`/api/admin/recommendation-rules/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !active })
            });
            if (!res.ok) throw new Error("Failed to update");
        } catch {
            // API 失败时回滚到之前的状态
            setRules(previousRules);
            alert("状态更新失败，请重试");
        }
    };

    const deleteRule = async (id: string) => {
        if (!confirm("确定要删除这条推荐规则吗？此操作不可撤销。")) return;
        try {
            const res = await fetch(`/api/admin/recommendation-rules/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete");
            setRules(prev => prev.filter(r => r.id !== id));
        } catch {
            alert("删除失败，请重试");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-[#3D4430]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-serif text-[#1A1A1A]">推荐规则</h1>
                    <p className="text-sm text-[#5E5E5E] mt-1">
                        管理肤质分析与产品推荐的关联规则
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 rounded-full bg-[#1A1A1A] px-5 py-2.5 text-xs font-bold tracking-widest text-white hover:bg-[#3D4430] transition-all uppercase"
                >
                    <Plus className="w-4 h-4" />
                    新建规则
                </button>
            </div>

            <div className="bg-white rounded-xl border border-[#3D4430]/10 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#F8F7F4] text-xs font-bold tracking-wider text-[#5E5E5E] uppercase">
                        <tr>
                            <th className="px-6 py-4">规则名称</th>
                            <th className="px-6 py-4">优先级</th>
                            <th className="px-6 py-4">条件</th>
                            <th className="px-6 py-4">关联产品</th>
                            <th className="px-6 py-4">状态</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3D4430]/5">
                        {rules.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-sm text-[#5E5E5E]">
                                    <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#3D4430]/20" />
                                    暂无推荐规则
                                </td>
                            </tr>
                        )}
                        {rules.map(rule => (
                            <tr key={rule.id} className="hover:bg-[#F8F7F4]/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-sm text-[#1A1A1A]">{rule.name}</div>
                                    {rule.message && (
                                        <div className="text-xs text-[#5E5E5E] mt-0.5">{rule.message}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center rounded-md bg-[#3D4430]/5 px-2.5 py-0.5 text-xs font-medium text-[#3D4430]">
                                        {rule.priority}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                        {(rule.conditions as { skinType?: string[] })?.skinType?.map(s => (
                                            <span key={s} className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded">{s}</span>
                                        ))}
                                        {(rule.conditions as { concern?: string[] })?.concern?.map(c => (
                                            <span key={c} className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-700 rounded">{c}</span>
                                        ))}
                                        {(rule.conditions as { persona?: string[] })?.persona?.map(r => (
                                            <span key={r} className="px-1.5 py-0.5 text-[10px] bg-amber-50 text-amber-700 rounded">
                                                {PERSONAS.find(p => p.value === r)?.label || r}
                                            </span>
                                        ))}
                                        {!((rule.conditions as { skinType?: string[] })?.skinType?.length || (rule.conditions as { concern?: string[] })?.concern?.length || (rule.conditions as { persona?: string[] })?.persona?.length) && (
                                            <span className="text-xs text-slate-400">—</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-[#5E5E5E]">
                                    {rule.productIds.length} 个产品
                                </td>
                                <td className="px-6 py-4">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={rule.active}
                                            onChange={() => toggleActive(rule.id, rule.active)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#3D4430]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3D4430]"></div>
                                    </label>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => openEdit(rule)}
                                            className="inline-flex items-center gap-1.5 text-xs text-[#5E5E5E] hover:text-[#1A1A1A] transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                            编辑
                                        </button>
                                        <button
                                            onClick={() => deleteRule(rule.id)}
                                            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            删除
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            {showModal && typeof window !== "undefined" && createPortal(
                <AnimatePresence>
                    {showModal && (
                        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="relative z-10 w-full max-w-2xl mx-4 bg-white/70 backdrop-blur-3xl rounded-[28px] border-[1.5px] border-white/80 shadow-[0_40px_100px_rgba(0,0,0,0.08),inset_0_2px_10px_rgba(255,255,255,0.5)] overflow-hidden max-h-[90vh] flex flex-col"
                            >
                                <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
                                    <div>
                                        <h3 className="text-lg font-bold text-[#2C2C2C] tracking-tight">
                                            {editingRule ? "编辑规则" : "新建推荐规则"}
                                        </h3>
                                        <p className="text-xs text-[#8B7355]">
                                            {editingRule ? "修改推荐规则信息" : "创建肤质与产品的关联规则"}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { setShowModal(false); resetForm(); }}
                                        disabled={submitting}
                                        className="p-2 rounded-full text-[#B0A89A] hover:text-[#C9A86C] hover:bg-white/60 transition-all"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="px-8 pb-8 overflow-y-auto">
                                    <div className="space-y-5">
                                        {/* Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                规则名称 <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formName}
                                                onChange={(e) => setFormName(e.target.value)}
                                                placeholder="例如：油性肌肤痘痘护理"
                                                required
                                                className="block w-full rounded-xl border-slate-200 bg-white/50 py-2.5 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-0 transition-all"
                                            />
                                        </div>

                                        {/* Priority */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                优先级
                                            </label>
                                            <input
                                                type="number"
                                                value={formPriority}
                                                onChange={(e) => setFormPriority(Number(e.target.value))}
                                                className="block w-full rounded-xl border-slate-200 bg-white/50 py-2.5 px-4 text-sm text-slate-900 focus:bg-white focus:border-slate-400 focus:ring-0 transition-all"
                                            />
                                            <p className="text-xs text-slate-400 mt-1">数字越大优先级越高</p>
                                        </div>

                                        {/* Conditions - Skin Type */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                肤质条件
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {SKIN_TYPES.map(type => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => toggleSelection(type, selectedSkinTypes, setSelectedSkinTypes)}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                            selectedSkinTypes.includes(type)
                                                                ? "bg-[#3D4430] text-white"
                                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                        }`}
                                                    >
                                                        {type === "dry" && "干性"}
                                                        {type === "oily" && "油性"}
                                                        {type === "combination" && "混合"}
                                                        {type === "sensitive" && "敏感"}
                                                        {type === "normal" && "中性"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Conditions - Concerns */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                肌肤问题
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {CONCERNS.map(concern => (
                                                    <button
                                                        key={concern}
                                                        type="button"
                                                        onClick={() => toggleSelection(concern, selectedConcerns, setSelectedConcerns)}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                            selectedConcerns.includes(concern)
                                                                ? "bg-[#3D4430] text-white"
                                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                        }`}
                                                    >
                                                        {concern}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Conditions - Personas */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                IP 形象（8 派）
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {PERSONAS.map(p => (
                                                    <button
                                                        key={p.value}
                                                        type="button"
                                                        onClick={() => toggleSelection(p.value, selectedPersonas, setSelectedPersonas)}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                            selectedPersonas.includes(p.value)
                                                                ? "bg-[#3D4430] text-white"
                                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                        }`}
                                                    >
                                                        {p.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Message */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                推荐语
                                            </label>
                                            <textarea
                                                value={formMessage}
                                                onChange={(e) => setFormMessage(e.target.value)}
                                                placeholder="输入推荐说明文字"
                                                rows={3}
                                                className="block w-full rounded-xl border-slate-200 bg-white/50 py-2.5 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-0 transition-all resize-none"
                                            />
                                        </div>

                                        {/* Product Selection */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                关联产品
                                            </label>
                                            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white/50 p-2 space-y-1">
                                                {products.length === 0 ? (
                                                    <p className="text-xs text-slate-400 px-2 py-1">暂无产品</p>
                                                ) : (
                                                    products.map(product => (
                                                        <label
                                                            key={product.id}
                                                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedProductIds.includes(product.id)}
                                                                onChange={() => toggleSelection(product.id, selectedProductIds, setSelectedProductIds)}
                                                                className="rounded border-slate-300 text-[#3D4430] focus:ring-[#3D4430]"
                                                            />
                                                            <span className="text-sm text-slate-700">{product.name}</span>
                                                            <span className="text-xs text-slate-400 ml-auto">{product.category}</span>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">
                                                已选择 {selectedProductIds.length} 个产品
                                            </p>
                                        </div>

                                        {/* Active */}
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formActive}
                                                onChange={(e) => setFormActive(e.target.checked)}
                                                className="rounded border-slate-300 text-[#3D4430] focus:ring-[#3D4430]"
                                            />
                                            <span className="text-sm text-slate-700">启用此规则</span>
                                        </label>
                                    </div>

                                    <div className="flex gap-3 mt-8">
                                        <button
                                            type="button"
                                            onClick={() => { setShowModal(false); resetForm(); }}
                                            disabled={submitting}
                                            className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-white/40 hover:bg-white/60 border border-white/60 rounded-2xl transition-all shadow-sm disabled:opacity-50"
                                        >
                                            取消
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="flex-1 px-4 py-3 text-sm font-bold text-white bg-[#1A1A1A] hover:bg-[#3D4430] rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70"
                                        >
                                            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                            {editingRule ? "保存修改" : "创建规则"}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
