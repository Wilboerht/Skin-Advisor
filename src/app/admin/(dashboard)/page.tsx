
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Package, Gift } from "lucide-react";

export default async function AdminDashboard() {
    const productCount = await prisma.product.count();
    const rewardCount = await prisma.shareReward.count();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h1>
                <p className="text-slate-500 text-sm mt-1">Snapshot of your advisor performance</p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Product Stats */}
                <Link href="/admin/products" className="block group">
                    <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100 transition-all duration-200 hover:shadow-lg hover:border-blue-100 hover:-translate-y-0.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Total Products</p>
                                <p className="text-3xl font-bold text-slate-900">{productCount}</p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                                <Package className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-400">
                            <span className="text-emerald-500">Active Catalog</span>
                        </div>
                    </div>
                </Link>

                {/* Reward Stats */}
                <Link href="/admin/rewards" className="block group">
                    <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100 transition-all duration-200 hover:shadow-lg hover:border-pink-100 hover:-translate-y-0.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Pending Rewards</p>
                                <p className="text-3xl font-bold text-slate-900">{rewardCount}</p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-50 text-pink-600 transition-colors group-hover:bg-pink-600 group-hover:text-white">
                                <Gift className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-400">
                            <span className="text-orange-500">Needs Fulfilment</span>
                        </div>
                    </div>
                </Link>
            </div>

            {productCount === 0 && (
                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-8 text-center sm:text-left shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center shrink-0 text-amber-600">
                            <Package className="w-8 h-8" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-amber-900">Initialize Your Catalog</h3>
                            <p className="mt-1 text-sm text-amber-800/80 leading-relaxed max-w-2xl">
                                The database seems to be empty. You can run the setup script to seed standard skincare products and questions.
                            </p>
                        </div>
                        <a href="/api/admin/setup" target="_blank" className="rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 shadow-md shadow-amber-900/10 hover:shadow-lg transition-all">
                            Run Setup / Seed Data
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
