"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCcw } from "lucide-react";

export default function ReportError({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    useEffect(() => {
        console.error("Report page error:", error);
    }, [error]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-brand-canvas px-4">
            <div className="w-full max-w-md rounded-2xl border border-brand-charcoal/[0.08] bg-white p-8 text-center shadow-sm">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500" strokeWidth={1.5} />
                <h2 className="mt-4 text-lg font-medium text-brand-charcoal">报告加载失败</h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-charcoal/60">
                    服务器暂时无法读取这份报告，请稍后重试。
                </p>
                {error.digest && (
                    <p className="mt-2 font-mono text-[11px] text-brand-charcoal/40">Error ID: {error.digest}</p>
                )}
                <div className="mt-6 flex justify-center gap-3">
                    <button
                        type="button"
                        onClick={() => retry()}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-brand-charcoal px-5 text-[13px] text-white"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        重试
                    </button>
                    <Link
                        href="/"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-brand-charcoal/20 px-5 text-[13px] text-brand-charcoal/70"
                    >
                        返回首页
                    </Link>
                </div>
            </div>
        </div>
    );
}
