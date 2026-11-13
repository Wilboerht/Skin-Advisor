'use client';

import { useEffect } from "react";
// global-error 会替换 Root Layout，不会自动加载根布局的全局样式
import "./globals.css";
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-reload";

export default function GlobalError({
    error,
    retry,
}: {
    error: unknown;
    retry: () => void;
}) {
    const chunkLoadFailed = isChunkLoadError(error);

    useEffect(() => {
        console.error("Global error:", error);
        // 发布新版本后旧页面引用的 chunk 已被删除：自动整页刷新一次拉取新构建
        if (chunkLoadFailed) {
            reloadOnceForChunkError();
        }
    }, [error, chunkLoadFailed]);

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
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    {chunkLoadFailed ? '页面已更新' : '遇到了一些问题'}
                </h2>
                <p className="text-gray-600 mb-6">
                    {chunkLoadFailed ? '正在为您加载最新版本，如未自动刷新请点击下方按钮。' : '页面加载遇到了小问题，刷新一下就好了。'}
                </p>
                <button
                    onClick={() => {
                        if (chunkLoadFailed) {
                            window.location.reload();
                        } else {
                            retry();
                        }
                    }}
                    className="px-6 py-2 bg-[#5c4937] text-white rounded-full hover:bg-[#4a3a2c] transition-colors"
                >
                    {chunkLoadFailed ? '刷新页面' : '刷新'}
                </button>
            </body>
        </html>
    );
}
