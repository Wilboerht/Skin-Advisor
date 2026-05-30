"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

import { Loader2, Trash2, Plus, Sparkles } from "lucide-react";

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

export default function RecommendationRulesPage() {
    const [rules, setRules] = useState<RecommendationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const fetchRules = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/recommendation-rules");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setRules(data);
        } catch {
            toast.error("加载推荐规则失败");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const toggleActive = async (id: string, active: boolean) => {
        try {
            const res = await fetch(`/api/admin/recommendation-rules/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !active })
            });
            if (!res.ok) throw new Error("Failed to update");
            setRules(prev => prev.map(r => r.id === id ? { ...r, active: !active } : r));
            toast.success("状态已更新");
        } catch {
            toast.error("更新失败");
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
            toast.success("规则已删除");
        } catch {
            toast.error("删除失败");
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
                    onClick={() => toast.info("创建规则功能即将上线")}
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
                                    <pre className="text-xs text-[#5E5E5E] bg-[#F8F7F4] rounded-md p-2 max-w-xs overflow-x-auto">
                                        {JSON.stringify(rule.conditions, null, 2)}
                                    </pre>
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
                                    <button
                                        onClick={() => deleteRule(rule.id)}
                                        className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        删除
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
