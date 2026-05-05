'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">出错了</h2>
                <p className="text-gray-600 mb-6">应用遇到意外错误，请刷新页面重试。</p>
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
