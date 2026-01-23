
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Package, Gift } from "lucide-react";

export default async function AdminDashboard() {
    const productCount = await prisma.product.count();
    const rewardCount = await prisma.shareReward.count();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Product Stats */}
                <Link href="/admin/products" className="block">
                    <div className="overflow-hidden rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <Package className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Total Products</p>
                                <p className="text-2xl font-semibold text-gray-900">{productCount}</p>
                            </div>
                        </div>
                    </div>
                </Link>

                {/* Reward Stats */}
                <Link href="/admin/rewards" className="block">
                    <div className="overflow-hidden rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                                <Gift className="h-6 w-6" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Pending Rewards</p>
                                <p className="text-2xl font-semibold text-gray-900">{rewardCount}</p>
                            </div>
                        </div>
                    </div>
                </Link>
            </div>

            {productCount === 0 && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
                    <h3 className="text-lg font-medium text-yellow-800">No products found</h3>
                    <p className="mt-2 text-sm text-yellow-700">
                        The database seems to be empty. You can seed it with default data.
                    </p>
                    <div className="mt-4">
                        {/* Client Component inlined logic or link to API */}
                        <a href="/api/admin/setup" target="_blank" className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500">
                            Run Setup / Seed Data
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
