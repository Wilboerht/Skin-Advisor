"use client";

import { useState } from "react";
import { Link } from "next-view-transitions";
import Image from "next/image";
import dynamic from "next/dynamic";
import { PRIVACY_DOC, TERMS_DOC } from "@/lib/legal-content";
import { useLazyOpen } from "@/hooks/use-lazy-open";

const LegalModal = dynamic(() => import("@/components/website/LegalModal").then((mod) => mod.LegalModal), { ssr: false });

/**
 * HomepageFooter — 首页页脚（版权 + 政策入口 + 备案）
 * 浅色低存在感。PC（≥1024px）：备案居左、链接与版权居右（ICP 的 mr-auto 形成左右两组），单行排列。
 * 手机/半屏（<1024px）：只保留公安备案 + ICP，左对齐；文字字号/字重/字距/颜色与 PC 完全一致。
 * 768px 以下隐藏公安备案与 ICP 之间的分隔符，避免窄屏折行时出现悬空竖线。
 * 「隐私政策 / 服务条款」打开站内简版弹窗（LegalModal），完整版在弹窗内链至官网；「常见问题」由父级回调打开 FaqModal。
 */
export function HomepageFooter({ onOpenFaq }: { onOpenFaq: () => void }) {
    const linkClass = "flex !min-h-0 !min-w-0 items-center hover:text-brand-charcoal/60 transition-colors cursor-pointer";
    const separatorClass = "text-brand-charcoal/40 select-none";

    // 简版法律文本弹窗：隐私政策 / 服务条款共用一个 LegalModal，同时只开一个
    const [legalDoc, setLegalDoc] = useState<"privacy" | "terms" | null>(null);
    const shouldRenderLegal = useLazyOpen(legalDoc !== null);

    return (
        <footer className="w-full flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-light tracking-[0.12em] text-brand-charcoal/70 max-pc:gap-x-2.5 pc:flex-nowrap pc:justify-start">
            {/* 公安备案：手机端与宽屏左组均为第一项 */}
            <Link
                href="http://www.beian.gov.cn/portal/registerSystemInfo"
                target="_blank"
                rel="noopener noreferrer"
                className={`order-1 ${linkClass} gap-1`}
            >
                <Image
                    src="/images/beian.webp"
                    alt=""
                    width={12}
                    height={12}
                    className="shrink-0 opacity-60"
                />
                <span>沪公网安备31010702010178号</span>
            </Link>

            <span aria-hidden="true" className={`order-2 max-md:hidden ${separatorClass}`}>|</span>

            {/* 版权：仅 PC 显示，宽屏右组最后；年份跨年瞬间 SSR/CSR 会不一致，抑制 hydration 告警 */}
            <p suppressHydrationWarning className="order-3 max-pc:hidden pc:order-10">
                <span className="hidden pc:inline">&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</span>
                <span className="pc:hidden">&copy; {new Date().getFullYear()} NIHPLOD</span>
            </p>

            {/* ICP 备案：手机端紧随公安备案，宽屏左组第二；mr-auto 把后续项推到右侧形成右组 */}
            <Link
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className={`order-5 pc:order-3 pc:mr-auto ${linkClass}`}
            >
                沪ICP备2026014764号-1
            </Link>

            <span aria-hidden="true" className={`order-6 max-pc:hidden pc:order-5 ${separatorClass}`}>|</span>

            <button
                type="button"
                onClick={() => setLegalDoc("privacy")}
                aria-haspopup="dialog"
                className={`order-7 max-pc:hidden pc:order-4 ${linkClass}`}
            >
                隐私政策
            </button>

            <span aria-hidden="true" className={`order-8 max-pc:hidden pc:order-7 ${separatorClass}`}>|</span>

            <button
                type="button"
                onClick={() => setLegalDoc("terms")}
                aria-haspopup="dialog"
                className={`order-9 max-pc:hidden pc:order-6 ${linkClass}`}
            >
                服务条款
            </button>

            <button
                type="button"
                onClick={onOpenFaq}
                aria-haspopup="dialog"
                className={`order-11 pc:order-8 hidden max-pc:hidden pc:flex ${linkClass}`}
            >
                常见问题
            </button>

            <span aria-hidden="true" className={`order-10 pc:order-9 hidden max-pc:hidden pc:inline ${separatorClass}`}>|</span>

            {shouldRenderLegal && (
                <LegalModal
                    isOpen={legalDoc !== null}
                    onClose={() => setLegalDoc(null)}
                    doc={legalDoc === "terms" ? TERMS_DOC : PRIVACY_DOC}
                />
            )}
        </footer>
    );
}
