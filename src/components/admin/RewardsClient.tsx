"use client";

import { useState } from "react";
import { Gift, ExternalLink, Truck, Clock, CheckCircle, XCircle, Square, CheckSquare } from "lucide-react";
import { RewardActions } from "./RewardActions";
import { RewardsToolbar } from "./RewardsToolbar";

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

interface RewardsClientProps {
    initialRewards: Reward[];
}

export default function RewardsClient({ initialRewards }: RewardsClientProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const rewards = initialRewards;

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === rewards.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(rewards.map(r => r.id));
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        <Clock className="mr-1 h-3 w-3" />
                        待审核
                    </span>
                );
            case 'approved':
                return (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        已通过
                    </span>
                );
            case 'shipped':
                return (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <Truck className="mr-1 h-3 w-3" />
                        已发货
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                        <XCircle className="mr-1 h-3 w-3" />
                        已拒绝
                    </span>
                );
            default:
                return <span className="text-slate-500">{status}</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">


            <RewardsToolbar
                totalCount={rewards.length}
                selectedIds={selectedIds}
                onSelectAll={handleSelectAll}
                onClearSelection={() => setSelectedIds([])}
                allSelected={selectedIds.length === rewards.length && rewards.length > 0}
            />

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                            <tr>
                                <th className="px-4 py-4 w-12">
                                    <button
                                        onClick={handleSelectAll}
                                        className="text-slate-400 hover:text-slate-600"
                                    >
                                        {selectedIds.length === rewards.length && rewards.length > 0 ? (
                                            <CheckSquare className="w-5 h-5" />
                                        ) : (
                                            <Square className="w-5 h-5" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-4 font-semibold w-64">用户信息</th>
                                <th className="px-6 py-4 font-semibold">肤质评分</th>
                                <th className="px-6 py-4 font-semibold">分享截图</th>
                                <th className="px-6 py-4 font-semibold">状态</th>
                                <th className="px-6 py-4 font-semibold">申请时间</th>
                                <th className="px-6 py-4 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {rewards.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                                <Gift className="h-6 w-6 text-slate-400" />
                                            </div>
                                            <p className="text-base font-medium text-slate-900">暂无奖赏申请</p>
                                            <p className="text-sm text-slate-400 mt-1 max-w-xs">当用户分享测肤结果并申请奖赏时，记录会显示在这里。</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                rewards.map((reward) => (
                                    <tr
                                        key={reward.id}
                                        className={`hover:bg-slate-50 transition-colors group ${selectedIds.includes(reward.id) ? 'bg-slate-50' : ''
                                            }`}
                                    >
                                        <td className="px-4 py-4">
                                            <button
                                                onClick={() => handleToggleSelect(reward.id)}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                {selectedIds.includes(reward.id) ? (
                                                    <CheckSquare className="w-5 h-5 text-slate-900" />
                                                ) : (
                                                    <Square className="w-5 h-5" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900">{reward.name}</span>
                                                <span className="text-slate-500 text-xs mt-0.5">{reward.phone}</span>
                                                <span className="text-slate-400 text-[11px] mt-1 line-clamp-1 max-w-[200px]" title={reward.address}>
                                                    {reward.address}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {reward.skinScore ? (
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-mono font-bold ${reward.skinScore >= 80 ? 'text-emerald-600' :
                                                        reward.skinScore >= 60 ? 'text-amber-600' : 'text-red-600'
                                                        }`}>
                                                        {reward.skinScore}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">
                                                        Top {100 - (reward.percentile || 0)}%
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {reward.shareProofUrl ? (
                                                <a
                                                    href={reward.shareProofUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100 transition-colors"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    查看截图
                                                </a>
                                            ) : (
                                                <span className="text-slate-400 text-xs">无截图</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(reward.status)}
                                            {reward.trackingNo && (
                                                <div className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-1">
                                                    <Truck className="w-3 h-3" />
                                                    {reward.trackingNo}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500">
                                            {new Date(reward.createdAt).toLocaleDateString()}
                                            <span className="block text-[10px] text-slate-400">
                                                {new Date(reward.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <RewardActions reward={reward} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
