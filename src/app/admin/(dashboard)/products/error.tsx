"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCcw, ArrowLeft } from "lucide-react";

export default function ProductsErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        console.error("Products page error:", error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="max-w-md w-full mx-4 p-8 bg-white/60 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/70 shadow-[0_40px_100px_rgba(0,0,0,0.08),inset_0_2px_10px_rgba(255,255,255,0.4)] text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">
                    产品列表加载失败
                </h2>
                <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                    加载产品数据时发生错误。您可以重试，或返回产品列表首页。
                </p>
                {error.digest && (
                    <p className="text-xs text-slate-400 mb-6 font-mono">
                        Error ID: {error.digest}
                    </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={() => router.push("/admin/products")}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        返回列表
                    </button>
                    <button
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        重试
                    </button>
                </div>
            </div>
        </div>
    );
}
