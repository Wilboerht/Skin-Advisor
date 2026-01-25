
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Gift, Search, ExternalLink, Truck, CheckCircle, Clock, XCircle, MoreHorizontal } from "lucide-react";
import Image from "next/image";

export default async function RewardsPage() {
    // Fetch rewards sorted by newest first
    const rewards = await prisma.shareReward.findMany({
        orderBy: { createdAt: "desc" },
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                    </span>
                );
            case 'approved':
                return (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Approved
                    </span>
                );
            case 'shipped':
                return (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <Truck className="mr-1 h-3 w-3" />
                        Shipped
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                        <XCircle className="mr-1 h-3 w-3" />
                        Rejected
                    </span>
                );
            default:
                return <span className="text-slate-500">{status}</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rewards Fulfillment</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage user reward claims and shipping status</p>
                </div>

                <div className="flex gap-2">
                    <button className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Filters Row (Placeholder) */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name, phone or tracking..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500"
                    />
                </div>
                <select className="rounded-lg border border-slate-200 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20 text-slate-700">
                    <option>All Status</option>
                    <option>Pending</option>
                    <option>Approved</option>
                    <option>Shipped</option>
                </select>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                            <tr>
                                <th className="px-6 py-4 font-semibold w-64">User Info</th>
                                <th className="px-6 py-4 font-semibold">Skin Score</th>
                                <th className="px-6 py-4 font-semibold">Proof</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {rewards.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                                <Gift className="h-6 w-6 text-slate-400" />
                                            </div>
                                            <p className="text-base font-medium text-slate-900">No reward claims yet</p>
                                            <p className="text-sm text-slate-400 mt-1 max-w-xs">When users share their results and claim rewards, they will appear here.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                rewards.map((reward) => (
                                    <tr key={reward.id} className="hover:bg-slate-50 transition-colors group">
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
                                                    View Proof
                                                </a>
                                            ) : (
                                                <span className="text-slate-400 text-xs">No proof</span>
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
                                            <button className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                                                <MoreHorizontal className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Footer Pagination Placeholder */}
                {rewards.length > 0 && (
                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Showing {rewards.length} results</span>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
