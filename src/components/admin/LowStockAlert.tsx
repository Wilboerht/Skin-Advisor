"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Package } from "lucide-react";
import { Loader2 } from "lucide-react";

interface Product {
    id: string;
    name: string;
    stock: number;
    image: string;
}

export function LowStockAlert() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLowStock = async () => {
            try {
                // In a real app we might want a dedicated endpoint for dashboard stats
                // For now, let's just fetch all and filter client side or assume we reuse the products API
                // But efficient way is to have an API. 
                // Let's assume we can fetch products and filter.

                const res = await fetch('/api/admin/products');
                if (res.ok) {
                    const data = await res.json();
                    // API returns array directly
                    const productsList = Array.isArray(data) ? data : (data.success ? data.data : []);

                    if (Array.isArray(productsList)) {
                        const lowStock = productsList
                            .filter((p: any) => p.stock <= 10)
                            .sort((a: any, b: any) => a.stock - b.stock)
                            .slice(0, 5);
                        setProducts(lowStock);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch stock status", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLowStock();
    }, []);

    if (loading) return null; // Don't show anything while loading to avoid layout shift or just show generic skeleton

    if (products.length === 0) return null; // No low stock items, nice!

    return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">库存预警</h3>
                        <p className="text-sm text-slate-500">发现 {products.length} 个产品库存不足</p>
                    </div>
                </div>
                <Link
                    href="/admin/products?filter=low"
                    className="group flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
                >
                    查看全部
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(product => (
                    <div key={product.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                        <div className="h-12 w-12 rounded-lg bg-slate-50 overflow-hidden border border-slate-100 shrink-0">
                            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium text-slate-900 truncate">{product.name}</h4>
                            <p className="text-xs text-amber-600 font-medium flex items-center mt-0.5">
                                <Package className="h-3 w-3 mr-1" />
                                剩余 {product.stock} 件
                            </p>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-4 pt-4 border-t border-amber-200/50 flex justify-end">
                <button
                    onClick={async () => {
                        try {
                            // Using send-test as a generic 'notify admin' endpoint for now
                            await fetch("/api/push/send-test", {
                                method: "POST",
                                body: JSON.stringify({
                                    title: "库存紧急预警",
                                    message: `现有 ${products.length} 款产品库存低于 10 件，请及时补货。`
                                })
                            });
                            alert("已发送预警推送给所有订阅管理员");
                        } catch (e) {
                            alert("推送发送失败");
                        }
                    }}
                    className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full hover:bg-amber-200 transition-colors"
                >
                    📢 推送通知给管理员
                </button>
            </div>
        </div>
    );
}
