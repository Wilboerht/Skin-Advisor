"use client";

import { X, Clock, ShoppingBag, Calendar, Smartphone, MapPin, Settings, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    onUpdate?: () => void;
}

interface UserDetail {
    id: string;
    email: string;
    phoneNumber?: string;
    name: string | null;
    role: string;
    dailyTestLimit: number;
    createdAt: string;
    advisorSessions: any[];
    _count?: {
        testRecords?: number;
    };
}

export function UserDetailModal({ isOpen, onClose, userId, onUpdate }: UserDetailModalProps) {
    const [user, setUser] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [editingLimit, setEditingLimit] = useState(false);
    const [newLimit, setNewLimit] = useState(1);
    const [saving, setSaving] = useState(false);
    const toast = useToast();
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && modalRef.current) {
            modalRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && userId) {
            setLoading(true);
            fetch(`/api/admin/users/${userId}`)
                .then(res => res.json())
                .then(data => {
                    setUser(data);
                    setNewLimit(data.dailyTestLimit || 1);
                })
                .catch((err) => {
                    console.error(err);
                    setUser(null);
                    toast.error("加载用户详情失败");
                })
                .finally(() => setLoading(false));
        } else {
            setUser(null);
            setEditingLimit(false);
        }
    }, [isOpen, userId]);

    const handleSaveLimit = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dailyTestLimit: newLimit })
            });
            if (res.ok) {
                const updated = await res.json();
                setUser({ ...user, dailyTestLimit: updated.dailyTestLimit });
                setEditingLimit(false);
                toast.success('测试次数限制已更新');
                onUpdate?.();
            } else {
                toast.error('更新失败');
            }
        } catch (err) {
            toast.error('网络错误');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                ref={modalRef}
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        onClose();
                    }
                }}
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {loading || !user ? (
                    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                        <p className="mt-4 text-sm text-slate-400">Loading user details...</p>
                    </div>
                ) : (
                    <div className="p-6 sm:p-8 space-y-8">
                        {/* Header */}
                        <div>
                            <h2 className="text-2xl font-serif text-slate-900">{user.name || "Anonymous User"}</h2>
                            <p className="text-slate-500 font-mono text-sm mt-1">{user.email || user.phoneNumber}</p>
                            <div className="flex items-center gap-3 mt-4">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'disabled' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                    {user.role}
                                </span>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Joined {new Date(user.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        {/* Test Limit Settings */}
                        <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Settings className="w-4 h-4" /> 测试次数限制
                            </h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-600">每日测试次数上限</p>
                                    <p className="text-xs text-slate-400 mt-1">默认为 1 次，可为特定用户调整</p>
                                </div>
                                {editingLimit ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={newLimit}
                                            onChange={(e) => setNewLimit(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                        />
                                        <button
                                            onClick={handleSaveLimit}
                                            disabled={saving}
                                            className="px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1"
                                        >
                                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                            保存
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingLimit(false);
                                                setNewLimit(user.dailyTestLimit || 1);
                                            }}
                                            className="px-3 py-1.5 text-slate-500 text-sm hover:bg-slate-100 rounded-lg"
                                        >
                                            取消
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl font-bold text-amber-600">{user.dailyTestLimit || 1}</span>
                                        <span className="text-sm text-slate-500">次/天</span>
                                        <button
                                            onClick={() => setEditingLimit(true)}
                                            className="px-3 py-1.5 text-amber-600 text-sm border border-amber-200 rounded-lg hover:bg-amber-100"
                                        >
                                            修改
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Activity Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Analysis History */}
                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Recent Analysis
                                </h3>
                                {user.advisorSessions && user.advisorSessions.length > 0 ? (
                                    <div className="space-y-3">
                                        {user.advisorSessions.slice(0, 3).map((session, idx) => (
                                            <div key={idx} className="flex items-start justify-between text-sm">
                                                <div>
                                                    <div className="font-medium text-slate-700">
                                                        {new Date(session.createdAt).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5 flex gap-1 items-center">
                                                        {session.deviceType === 'mobile' ? <Smartphone className="w-3 h-3" /> : 'Desktop'}
                                                        <span>•</span>
                                                        {session.province || 'Unknown Loc'}
                                                    </div>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded ${session.completedAt ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {session.completedAt ? 'Completed' : 'Dropped'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">No analysis history</p>
                                )}
                            </div>
                        </div>


                    </div>
                )}
            </div>
        </div>
    );
}
