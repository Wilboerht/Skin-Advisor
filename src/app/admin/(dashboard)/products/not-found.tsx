import Link from "next/link";
import { PackageX, ArrowLeft } from "lucide-react";

export default function ProductsNotFound() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="max-w-md w-full mx-4 p-8 bg-white/60 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/70 shadow-[0_40px_100px_rgba(0,0,0,0.08),inset_0_2px_10px_rgba(255,255,255,0.4)] text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-6">
                    <PackageX className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">
                    页面未找到
                </h2>
                <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                    您访问的产品页面不存在或已被移除。
                </p>
                <Link
                    href="/admin/products"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回产品列表
                </Link>
            </div>
        </div>
    );
}
