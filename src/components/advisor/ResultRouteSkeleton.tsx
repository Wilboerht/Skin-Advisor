/**
 * 结果页路由级骨架屏
 *
 * 使用方：/result 与 /reports/:id 的 loading.tsx。
 * 这两个路由的服务端组件需要先完成会话校验（SSO 验证/静默轮换）与 DB 查询，
 * 慢请求时先展示与结果页版式对齐的骨架（顶部栏 + 证书卡 + 操作按钮占位），
 * 避免白屏或全局 spinner 造成的割裂感。
 */
export function ResultRouteSkeleton() {
    return (
        <div
            className="fixed inset-0 overflow-hidden bg-[#E8E2D9]"
            aria-busy="true"
            aria-label="报告加载中"
        >
            {/* 顶部栏骨架（毛玻璃底 + 居中 logo 占位） */}
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center bg-[#E8E2D9]/90 px-4 pb-5 pt-[calc(1.75rem+env(safe-area-inset-top,0px))] backdrop-blur-sm">
                <div className="h-7 w-[120px] animate-pulse rounded-md bg-[#3d2f25]/10 md:h-9" />
            </div>

            {/* 标题 + 证书卡 + 操作按钮骨架 */}
            <div className="mx-auto w-full max-w-[900px] px-6 pt-[calc(5.5rem+env(safe-area-inset-top,0px))] md:px-8">
                <div className="mx-auto mb-5 h-5 w-64 max-w-full animate-pulse rounded-full bg-[#3d2f25]/10" />
                <div className="mx-auto mb-6 h-[420px] max-h-[52vh] w-full max-w-[560px] animate-pulse rounded-[24px] border border-[#3d2f25]/10 bg-white/45" />
                <div className="mx-auto h-11 w-full max-w-[280px] animate-pulse rounded-full bg-[#3d2f25]/[0.08]" />
                <div className="mx-auto mt-4 h-10 w-full max-w-[240px] animate-pulse rounded-full bg-[#3d2f25]/[0.06]" />
            </div>
        </div>
    );
}
