"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Plus,
    Calendar,
    Gift,
    Users,
    MoreHorizontal,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    Loader2,
    AlertCircle,
    LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

import RewardsClient from "./RewardsClient";

interface Campaign {
    id: string;
    name: string;
    description: string | null;
    rewardType: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    maxParticipants: number | null;
    currentParticipants: number;
    _count?: {
        rewards: number;
    };
}

interface Reward {
    id: string;
    name: string;
    phone: string;
    address: string;
    shareProofUrl: string;
    skinScore: number | null;
    percentile: number | null;
    status: string;
    trackingNo: string | null;
    createdAt: string;
}

interface CampaignsClientProps {
    initialRewards: Reward[];
}

export default function CampaignsClient({ initialRewards }: CampaignsClientProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"campaigns" | "rewards">("campaigns");
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null }>({
        show: false,
        id: null
    });
    const toast = useToast();

    const fetchCampaigns = async () => {
        try {
            const res = await fetch('/api/admin/campaigns');
            if (!res.ok) throw new Error('Failed to fetch campaigns');
            const data = await res.json();
            if (data.success) {
                setCampaigns(data.data);
            }
        } catch (error) {
            console.error(error);
            toast.error("加载活动列表失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const handleDelete = async () => {
        if (!deleteConfirm.id) return;

        try {
            const res = await fetch(`/api/admin/campaigns/${deleteConfirm.id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                toast.success("活动已删除");
                fetchCampaigns();
            } else {
                toast.error("删除失败");
            }
        } catch (error) {
            toast.error("网络错误");
        } finally {
            setDeleteConfirm({ show: false, id: null });
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean, name: string) => {
        try {
            const res = await fetch(`/api/admin/campaigns/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    isActive: !currentStatus
                })
            });

            if (res.ok) {
                toast.success(currentStatus ? "活动已停用" : "活动已启用");
                fetchCampaigns();
            } else {
                toast.error("更新状态失败");
            }
        } catch (error) {
            toast.error("网络错误");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 animate-in fade-in duration-500">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">活动中心</h1>
                    <p className="text-slate-500 text-sm mt-1">管理营销活动、奖励规则及领奖审批</p>
                </div>
                {activeTab === "campaigns" && (
                    <Link
                        href="/admin/campaigns/new"
                        className="flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        创建活动
                    </Link>
                )}
            </div>

            {/* Tabs Controller */}
            <div className="flex items-center gap-1 p-1 bg-white/40 backdrop-blur-xl rounded-2xl w-fit border-[1.5px] border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05),inset_0_1px_5px_rgba(255,255,255,0.4)]">
                <button
                    onClick={() => setActiveTab("campaigns")}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all relative group",
                        activeTab === "campaigns" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    {activeTab === "campaigns" && (
                        <motion.div
                            layoutId="activeTabBackground"
                            className="absolute inset-0 bg-white shadow-sm border border-white/40 backdrop-blur-sm rounded-xl -z-10"
                            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                    )}
                    <LayoutDashboard className={cn("w-4 h-4 transition-colors", activeTab === "campaigns" ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600")} />
                    活动概览
                </button>
                <button
                    onClick={() => setActiveTab("rewards")}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all relative group",
                        activeTab === "rewards" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    {activeTab === "rewards" && (
                        <motion.div
                            layoutId="activeTabBackground"
                            className="absolute inset-0 bg-white shadow-sm border border-white/40 backdrop-blur-sm rounded-xl -z-10"
                            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                        />
                    )}
                    <Gift className={cn("w-4 h-4 transition-colors", activeTab === "rewards" ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600")} />
                    领奖审批
                    {initialRewards.filter(r => r.status === 'pending').length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                            {initialRewards.filter(r => r.status === 'pending').length}
                        </span>
                    )}
                </button>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === "campaigns" ? (
                    <motion.div
                        key="campaigns-tab"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                    >
                        {campaigns.map((campaign) => (
                            <div
                                key={campaign.id}
                                className={`group relative flex flex-col overflow-hidden rounded-[32px] border-[1.5px] bg-white/40 backdrop-blur-3xl transition-all hover:shadow-xl ${campaign.isActive ? 'border-emerald-200 ring-4 ring-emerald-500/10' : 'border-white/60 shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)]'
                                    }`}
                            >
                                <div className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${campaign.isActive
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {campaign.isActive ? '进行中' : '已结束'}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Link
                                                href={`/admin/campaigns/${campaign.id}/edit`}
                                                className="rounded p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                                                title="编辑"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Link>
                                            <button
                                                onClick={() => setDeleteConfirm({ show: true, id: campaign.id })}
                                                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                title="删除"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="mt-3 text-lg font-semibold text-slate-900 line-clamp-1" title={campaign.name}>
                                        {campaign.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500 line-clamp-2 h-10" title={campaign.description || ''}>
                                        {campaign.description || "暂无描述"}
                                    </p>

                                    <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
                                        <div className="flex flex-col justify-center items-start">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">活动周期</p>
                                            <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                <span>
                                                    {format(new Date(campaign.startDate), 'MM/dd')} - {format(new Date(campaign.endDate), 'MM/dd')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col justify-center items-start">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">奖励类型</p>
                                            <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                                <Gift className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="capitalize">{campaign.rewardType}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between">
                                            <span>参与进度</span>
                                            {campaign.maxParticipants && (
                                                <span>{Math.round((campaign.currentParticipants / campaign.maxParticipants) * 100)}%</span>
                                            )}
                                        </p>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/20 backdrop-blur-sm border border-white/20">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${paramsToColor(campaign)}`}
                                                style={{
                                                    width: `${campaign.maxParticipants ? Math.min((campaign.currentParticipants / campaign.maxParticipants) * 100, 100) : 0}%`
                                                }}
                                            />
                                        </div>
                                        <div className="mt-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                {campaign.currentParticipants} 人已参与
                                            </span>
                                            {campaign.maxParticipants && (
                                                <span>上限 {campaign.maxParticipants}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex border-t border-white/20 bg-white/20 p-4">
                                    <button
                                        onClick={() => toggleStatus(campaign.id, campaign.isActive, campaign.name)}
                                        className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition-all ${campaign.isActive
                                            ? "bg-white/80 text-slate-700 shadow-sm border border-white/60 hover:bg-white"
                                            : "bg-slate-900 text-white shadow-lg hover:shadow-slate-900/40"
                                            }`}
                                    >
                                        {campaign.isActive ? (
                                            <>
                                                <XCircle className="h-4 w-4" />
                                                停止活动
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4" />
                                                启用活动
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}

                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Link
                                href="/admin/campaigns/new"
                                className="group relative flex flex-col items-center justify-center h-full min-h-[300px] overflow-hidden rounded-[32px] border-[1.5px] border-dashed border-white/60 bg-white/20 backdrop-blur-xl p-6 text-center transition-all hover:bg-white/40 shadow-[inset_0_2px_10px_rgba(255,255,255,0.4)]"
                            >
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/50 border border-white/60 shadow-sm group-hover:scale-110 transition-transform">
                                    <Plus className="h-8 w-8 text-slate-400 group-hover:text-slate-900 transition-colors" />
                                </div>
                                <h3 className="mt-6 text-base font-bold text-slate-900">创建新活动</h3>
                                <p className="mt-1 text-sm text-slate-500 px-4">配置新的营销活动和奖励规则</p>
                            </Link>
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="rewards-tab"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        <RewardsClient initialRewards={initialRewards} />
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmModal
                isOpen={deleteConfirm.show}
                onClose={() => setDeleteConfirm({ show: false, id: null })}
                onConfirm={handleDelete}
                title="删除活动"
                message="确定要删除这个活动吗？此操作无法撤销。"
                variant="danger"
                confirmText="删除"
            />
        </div>
    );
}

function paramsToColor(campaign: Campaign) {
    if (!campaign.maxParticipants) return "bg-slate-300";
    const percentage = campaign.currentParticipants / campaign.maxParticipants;
    if (percentage >= 0.9) return "bg-red-500";
    if (percentage >= 0.7) return "bg-amber-500";
    return "bg-emerald-500";
}
