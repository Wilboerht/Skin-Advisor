'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-reload';

export default function ErrorBoundary({
    error,
    retry,
}: {
    error: unknown;
    retry: () => void;
}) {
    const chunkLoadFailed = isChunkLoadError(error);

    useEffect(() => {
        console.error('App error:', error);
        // 发布新版本后旧页面引用的 chunk 已被删除：自动整页刷新一次拉取新构建
        if (chunkLoadFailed) {
            reloadOnceForChunkError();
        }
    }, [error, chunkLoadFailed]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
                {chunkLoadFailed ? '页面已更新' : '页面出现了问题'}
            </h2>
            <p className="text-gray-600 mb-6">
                {chunkLoadFailed ? '正在为您加载最新版本，如未自动刷新请点击下方按钮。' : '遇到了点小问题，点击下方按钮重试。'}
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
                {chunkLoadFailed ? '刷新页面' : '重试'}
            </button>
        </div>
    );
}
