
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Package, Gift } from "lucide-react";
import { DashboardCharts } from "@/components/admin/charts/DashboardCharts";
import { SetupButton } from "@/components/admin/SetupButton";

export default async function AdminDashboard() {
    const productCount = await prisma.product.count();
    const rewardCount = await prisma.shareReward.count();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-serif text-[#1A1A1A]">控制台概览</h1>
                <p className="text-[#1A1A1A]/60 text-sm mt-1">您的顾问系统运行快照</p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Product Stats */}
                <Link href="/admin/products" className="block group">
                    <div className="overflow-hidden rounded-2xl bg-white p-6 border border-[#1A1A1A]/5 transition-all duration-300 hover:shadow-lg hover:border-[#1A1A1A]/20 hover:-translate-y-0.5 relative">
                        <div className="flex items-center justify-between relative z-10">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">产品总数</p>
                                <p className="text-4xl font-serif text-[#1A1A1A]">{productCount}</p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3D4430]/5 text-[#3D4430] transition-transform group-hover:scale-110">
                                <Package className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-[#1A1A1A]/40">
                            <span className="flex items-center gap-1.5 text-[#3D4430]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#3D4430]"></span>
                                活跃目录
                            </span>
                        </div>
                    </div>
                </Link>

                {/* Reward Stats */}
                <Link href="/admin/rewards" className="block group">
                    <div className="overflow-hidden rounded-2xl bg-white p-6 border border-[#1A1A1A]/5 transition-all duration-300 hover:shadow-lg hover:border-[#1A1A1A]/20 hover:-translate-y-0.5 relative">
                        <div className="flex items-center justify-between relative z-10">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">待处理领奖</p>
                                <p className="text-4xl font-serif text-[#1A1A1A]">{rewardCount}</p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C19F70]/10 text-[#C19F70] transition-transform group-hover:scale-110">
                                <Gift className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-[#1A1A1A]/40">
                            <span className="flex items-center gap-1.5 text-[#C19F70]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C19F70]"></span>
                                需要履行
                            </span>
                        </div>
                    </div>
                </Link>
            </div>



            {/* Charts Section */}
            <DashboardCharts />

            {productCount === 0 && (
                <div className="rounded-2xl border border-[#C19F70]/20 bg-[#C19F70]/5 p-8 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="h-14 w-14 bg-[#C19F70]/10 rounded-full flex items-center justify-center shrink-0 text-[#C19F70]">
                            <Package className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-serif text-[#1A1A1A]">初始化产品库</h3>
                            <p className="mt-1 text-sm text-[#1A1A1A]/60 leading-relaxed max-w-2xl">
                                数据库似乎是空的。您可以运行初始化脚本来生成标准护肤产品数据。
                            </p>
                        </div>
                        <SetupButton />
                    </div>
                </div>
            )}
        </div>
    );
}
