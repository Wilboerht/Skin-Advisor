"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { motion } from "framer-motion";

interface RewardsToolbarProps {
    totalCount: number;
    selectedIds: string[];
    onSelectAll: () => void;
    onClearSelection: () => void;
    allSelected: boolean;
}

export function RewardsToolbar({
    totalCount,
    selectedIds,
    onSelectAll,
    onClearSelection,
    allSelected
}: RewardsToolbarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const toast = useToast();
    const [exporting, setExporting] = useState(false);
    const [batchLoading, setBatchLoading] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const currentStatus = searchParams.get("status") || "all";

    const handleStatusChange = (status: string) => {
        const params = new URLSearchParams(searchParams);
        if (status === "all") {
            params.delete("status");
        } else {
            params.set("status", status);
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams();
            if (currentStatus !== "all") params.set("status", currentStatus);

            const res = await fetch(`/api/admin/rewards/export?${params.toString()}`);
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `rewards-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                toast.success("导出成功");
            } else {
                toast.error("导出失败");
            }
        } catch (e) {
            toast.error("导出失败");
        } finally {
            setExporting(false);
        }
    };

    const handleBatchAction = async (action: string) => {
        if (selectedIds.length === 0) {
            toast.info("请先选择要操作的记录");
            return;
        }

        setBatchLoading(action);
        try {
            const res = await fetch('/api/admin/rewards/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, action }),
            });

            if (res.ok) {
                const actionName = action === 'approve' ? '批量通过' : action === 'reject' ? '批量拒绝' : '批量删除';
                toast.success(`${actionName}成功，已处理 ${selectedIds.length} 条记录`);
                router.refresh();
                onClearSelection();
            } else {
                toast.error("批量操作失败");
            }
        } catch (e) {
            toast.error("网络错误");
        } finally {
            setBatchLoading(null);
        }
    };

    const handleBatchDelete = () => {
        if (selectedIds.length === 0) {
            toast.info("请先选择要删除的记录");
            return;
        }
        setShowDeleteConfirm(true);
    };

    return (
        <>
            <div className="space-y-4">
                {/* Filter Row - Liquid Glass Upgrade */}
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex gap-1 bg-white/40 backdrop-blur-xl rounded-2xl p-1 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
                        {[
                            { value: 'all', label: '全部' },
                            { value: 'pending', label: '待审核' },
                            { value: 'approved', label: '已通过' },
                            { value: 'shipped', label: '已发货' },
                            { value: 'rejected', label: '已拒绝' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleStatusChange(opt.value)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all relative group ${currentStatus === opt.value
                                    ? 'text-slate-900'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                {currentStatus === opt.value && (
                                    <motion.div
                                        layoutId="activeFilter"
                                        className="absolute inset-0 bg-white shadow-sm border border-white/40 rounded-xl -z-10"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1" />

                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-white/40 backdrop-blur-xl border border-white/60 rounded-xl hover:bg-white/60 transition-all shadow-sm"
                    >
                        {exporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4 shadow-sm" />
                        )}
                        导出 CSV
                    </button>
                </div>

                {/* Batch Actions (when items selected) - Floating Liquid Glass */}
                {selectedIds.length > 0 && (
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 p-3 bg-white/40 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/60 shadow-[0_40px_100px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.4)] animate-in fade-in slide-in-from-bottom-10 duration-500 w-full max-w-xl ring-1 ring-white/20">
                        <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl -z-10 opacity-70" />
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/5 rounded-full border border-slate-900/10">
                            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                已选择 {selectedIds.length} 条记录
                            </span>
                        </div>
                        <div className="flex-1" />
                        <button
                            onClick={() => handleBatchAction('approve')}
                            disabled={batchLoading !== null}
                            className="px-4 py-2 text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-2xl transition-all shadow-sm active:scale-95"
                        >
                            {batchLoading === 'approve' ? '处理中...' : '批量通过'}
                        </button>
                        <button
                            onClick={() => handleBatchAction('reject')}
                            disabled={batchLoading !== null}
                            className="px-4 py-2 text-xs font-bold bg-rose-500/10 text-rose-700 border border-rose-500/20 hover:bg-rose-500/20 rounded-2xl transition-all shadow-sm active:scale-95"
                        >
                            {batchLoading === 'reject' ? '处理中...' : '批量拒绝'}
                        </button>
                        <button
                            onClick={onClearSelection}
                            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            取消选择
                        </button>
                    </div>
                )}
            </div>

            {/* Batch Delete Confirm */}
            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={() => handleBatchAction('delete')}
                title="批量删除确认"
                message={`确定要删除选中的 ${selectedIds.length} 条记录吗？此操作无法撤销。`}
                confirmText="删除"
                variant="danger"
                loading={batchLoading === 'delete'}
            />
        </>
    );
}
