"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * SSO 跳转壳页面的品牌 loading 界面。
 * 整页跳转在弱网下需要数秒，展示 logo + spinner 避免白屏；
 * 8 秒未完成跳转则视为失败，提供重试与返回出口（避免用户卡死在转圈页）。
 */
export function SsoRedirectScreen({ message }: { message: string }) {
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setTimedOut(true), 8000);
        return () => clearTimeout(timer);
    }, []);

    // 注意：不能用 <main>——layout 已提供唯一 <main id="main-content"> 地标
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] px-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/NIHPLOD-logo.svg" alt="NIHPLOD" className="h-[52px] object-contain" />
            {timedOut ? (
                <>
                    <p className="mt-10 text-sm tracking-wide text-brand-charcoal/70" role="alert">
                        跳转似乎失败了，请检查网络后重试
                    </p>
                    <div className="mt-6 flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="h-10 px-6 rounded-full bg-brand-charcoal text-white text-[13px] tracking-[0.08em] font-light transition-opacity hover:opacity-90 cursor-pointer"
                        >
                            重试
                        </button>
                        <Link
                            href="/"
                            className="h-10 px-6 inline-flex items-center rounded-full border border-brand-charcoal/25 text-brand-charcoal text-[13px] tracking-[0.08em] font-light transition-colors hover:border-brand-charcoal/60"
                        >
                            返回首页
                        </Link>
                    </div>
                </>
            ) : (
                <>
                    <div
                        className="mt-10 h-8 w-8 animate-spin rounded-full border-2 border-brand-charcoal/20 border-t-brand-charcoal"
                        role="status"
                        aria-label={message}
                    />
                    <p className="mt-6 text-sm tracking-wide text-brand-charcoal/70">{message}</p>
                </>
            )}
        </div>
    );
}

/**
 * Cookie 全禁时的拦截界面：SSO 登录依赖 Cookie 种会话，禁用状态下跳转
 * 只会在回调时失败兜圈，直接提示用户开启 Cookie（login/register 壳页共用）。
 */
export function SsoCookiesDisabledScreen() {
    return (
        // 注意：不能用 <main>——layout 已提供唯一 <main id="main-content"> 地标
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] px-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/NIHPLOD-logo.svg" alt="NIHPLOD" className="h-[52px] object-contain" />
            <p className="mt-10 text-sm tracking-wide text-brand-charcoal/70" role="alert">
                请开启浏览器 Cookie 后再登录
            </p>
            <p className="mt-3 text-xs tracking-wide text-brand-charcoal/50">
                登录状态需要通过 Cookie 保存，开启后刷新本页即可继续
            </p>
            <div className="mt-6 flex items-center gap-4">
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="h-10 px-6 rounded-full bg-brand-charcoal text-white text-[13px] tracking-[0.08em] font-light transition-opacity hover:opacity-90 cursor-pointer"
                >
                    已开启，刷新继续
                </button>
                <Link
                    href="/"
                    className="h-10 px-6 inline-flex items-center rounded-full border border-brand-charcoal/25 text-brand-charcoal text-[13px] tracking-[0.08em] font-light transition-colors hover:border-brand-charcoal/60"
                >
                    返回首页
                </Link>
            </div>
        </div>
    );
}
