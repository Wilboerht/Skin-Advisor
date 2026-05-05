'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('App error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">出错了</h2>
            <p className="text-gray-600 mb-6">页面加载出现问题，请重试。</p>
            <button
                onClick={reset}
                className="px-6 py-2 bg-[#5c4937] text-white rounded-full hover:bg-[#4a3a2c] transition-colors"
            >
                重试
            </button>
        </div>
    );
}
