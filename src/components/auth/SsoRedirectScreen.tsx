"use client";

/**
 * SSO 跳转壳页面的品牌 loading 界面。
 * 整页跳转在弱网下需要数秒，展示 logo + spinner 避免白屏。
 */
export function SsoRedirectScreen({ message }: { message: string }) {
    // 注意：不能用 <main>——layout 已提供唯一 <main id="main-content"> 地标
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] px-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/NIHPLOD-logo.svg" alt="NIHPLOD" className="h-[52px] object-contain" />
            <div
                className="mt-10 h-8 w-8 animate-spin rounded-full border-2 border-brand-charcoal/20 border-t-brand-charcoal"
                role="status"
                aria-label={message}
            />
            <p className="mt-6 text-sm tracking-wide text-brand-charcoal/70">{message}</p>
        </div>
    );
}
