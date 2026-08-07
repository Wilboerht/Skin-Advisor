'use client';

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global error:", error);
    }, [error]);

    return (
        <html lang="zh-CN">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
                <meta name="robots" content="noindex, nofollow" />
                <title>遇到了一些问题 — NIHPLOD</title>
                <link rel="icon" href="/favicon.ico" sizes="any" />
            </head>
            <body className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">遇到了一些问题</h2>
                <p className="text-gray-600 mb-6">页面加载遇到了小问题，刷新一下就好了。</p>
                <button
                    onClick={reset}
                    className="px-6 py-2 bg-[#5c4937] text-white rounded-full hover:bg-[#4a3a2c] transition-colors"
                >
                    刷新
                </button>
            </body>
        </html>
    );
}
