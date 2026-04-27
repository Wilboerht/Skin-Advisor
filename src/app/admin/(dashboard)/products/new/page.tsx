
import ProductForm from "@/components/admin/ProductForm";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";

export default function NewProductPage() {
    return (
        <div className="space-y-4">
            {/* 面包屑 */}
            <nav className="flex items-center gap-2 text-sm text-slate-500">
                <Link href="/admin/products" className="hover:text-slate-900 transition-colors">产品管理</Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-slate-900 font-medium">新建产品</span>
            </nav>

            {/* 页面头部 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">新建产品</h1>
                        <p className="text-sm text-slate-500">填写产品信息并发布到前端展示</p>
                    </div>
                </div>
            </div>

            <ProductForm />
        </div>
    );
}
