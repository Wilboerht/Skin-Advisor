"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    CheckCircle,
    XCircle,
    Truck,
    MoreHorizontal,
    Loader2,
    ExternalLink,
    Trash2
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface RewardActionsProps {
    reward: {
        id: string;
        status: string;
        trackingNo: string | null;
    };
}

export function RewardActions({ reward }: RewardActionsProps) {
    const router = useRouter();
    const toast = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [showShipModal, setShowShipModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [trackingNo, setTrackingNo] = useState("");

    const handleAction = async (action: 'approve' | 'reject') => {
        setLoading(action);
        try {
            const res = await fetch(`/api/admin/rewards/${reward.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: action === 'approve' ? 'approved' : 'rejected'
                }),
            });

            if (res.ok) {
                toast.success(action === 'approve' ? '已审核通过' : '已拒绝申请');
                router.refresh();
            } else {
                toast.error('操作失败，请重试');
            }
        } catch (e) {
            toast.error('网络错误');
        } finally {
            setLoading(null);
            setIsOpen(false);
        }
    };

    const handleDelete = async () => {
        setLoading('delete');
        try {
            const res = await fetch(`/api/admin/rewards/${reward.id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                toast.success('记录已删除');
                router.refresh();
            } else {
                toast.error('删除失败');
            }
        } catch (e) {
            toast.error('网络错误');
        } finally {
            setLoading(null);
            setShowDeleteConfirm(false);
        }
    };

    const handleShip = async () => {
        if (!trackingNo.trim()) {
            toast.error('请输入快递单号');
            return;
        }

        setLoading('ship');
        try {
            const res = await fetch(`/api/admin/rewards/${reward.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'shipped',
                    trackingNo: trackingNo.trim()
                }),
            });

            if (res.ok) {
                toast.success('已标记发货');
                router.refresh();
                setShowShipModal(false);
                setTrackingNo("");
            } else {
                toast.error('发货失败');
            }
        } catch (e) {
            toast.error('网络错误');
        } finally {
            setLoading(null);
        }
    };

    return (
        <>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
                >
                    <MoreHorizontal className="w-5 h-5" />
                </button>

                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Dropdown */}
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                            {reward.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => handleAction('approve')}
                                        disabled={loading !== null}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-slate-50 text-emerald-600"
                                    >
                                        {loading === 'approve' ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <CheckCircle className="w-4 h-4" />
                                        )}
                                        审核通过
                                    </button>
                                    <button
                                        onClick={() => handleAction('reject')}
                                        disabled={loading !== null}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-slate-50 text-red-600"
                                    >
                                        {loading === 'reject' ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <XCircle className="w-4 h-4" />
                                        )}
                                        拒绝
                                    </button>
                                </>
                            )}

                            {reward.status === 'approved' && (
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        setShowShipModal(true);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-slate-50 text-blue-600"
                                >
                                    <Truck className="w-4 h-4" />
                                    标记发货
                                </button>
                            )}

                            {reward.trackingNo && (
                                <a
                                    href={`https://www.kuaidi100.com/chaxun?nu=${reward.trackingNo}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-slate-50 text-slate-600"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    查看物流
                                </a>
                            )}

                            <div className="border-t border-slate-100 my-1" />

                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    setShowDeleteConfirm(true);
                                }}
                                disabled={loading !== null}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600"
                            >
                                <Trash2 className="w-4 h-4" />
                                删除记录
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Delete Confirm Modal */}
            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="确认删除"
                message="删除后将无法恢复此奖赏申请记录。确定要继续吗？"
                confirmText="删除"
                variant="danger"
                loading={loading === 'delete'}
            />

            {/* Ship Modal */}
            {showShipModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">标记发货</h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                快递单号
                            </label>
                            <input
                                type="text"
                                value={trackingNo}
                                onChange={(e) => setTrackingNo(e.target.value)}
                                placeholder="请输入快递单号..."
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowShipModal(false);
                                    setTrackingNo("");
                                }}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleShip}
                                disabled={loading === 'ship'}
                                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {loading === 'ship' && <Loader2 className="w-4 h-4 animate-spin" />}
                                确认发货
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
