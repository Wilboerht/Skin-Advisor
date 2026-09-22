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
 * 浅色低存在感。宽屏（≥1440px）：备案居左、链接与版权居右（ICP 的 mr-auto 形成左右两组），单行排列。
 * 窄屏（<1440px）：居中两行——第一行 公安备案 | 版权，第二行 ICP备案 | 隐私政策 | 服务条款；
 * 通过 flex order 重排实现，宽屏顺序与分组不变。
 * 「隐私政策 / 服务条款」打开站内简版弹窗（LegalModal），完整版在弹窗内链至官网。
 */
export function HomepageFooter() {
    const linkClass = "flex !min-h-0 !min-w-0 items-center hover:text-brand-charcoal/60 transition-colors cursor-pointer";
    const separatorClass = "text-brand-charcoal/40 select-none";

    // 简版法律文本弹窗：隐私政策 / 服务条款共用一个 LegalModal，同时只开一个
    const [legalDoc, setLegalDoc] = useState<"privacy" | "terms" | null>(null);
    const shouldRenderLegal = useLazyOpen(legalDoc !== null);

    return (
        <footer className="w-full flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-light tracking-[0.12em] text-brand-charcoal/70 pc:flex-nowrap pc:justify-start">
            {/* 公安备案：窄屏第一行左，宽屏左组第一 */}
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

            <span aria-hidden="true" className={`order-2 ${separatorClass}`}>|</span>

            {/* 版权：窄屏第一行右，宽屏右组最后；窄屏用简写避免拥挤，
                年份跨年瞬间 SSR/CSR 会不一致，抑制 hydration 告警 */}
            <p suppressHydrationWarning className="order-3 pc:order-8">
                <span className="hidden pc:inline">&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</span>
                <span className="pc:hidden">&copy; {new Date().getFullYear()} NIHPLOD</span>
            </p>

            {/* 窄屏断行（宽屏不渲染） */}
            <div aria-hidden="true" className="order-4 basis-full h-0 pc:hidden" />

            {/* ICP 备案：窄屏第二行首，宽屏左组第二；mr-auto 把后续项推到右侧形成右组 */}
            <Link
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className={`order-5 pc:order-3 pc:mr-auto ${linkClass}`}
            >
                沪ICP备2026014764号-1
            </Link>

            <span aria-hidden="true" className={`order-6 pc:order-5 ${separatorClass}`}>|</span>

            <button
                type="button"
                onClick={() => setLegalDoc("privacy")}
                aria-haspopup="dialog"
                className={`order-7 pc:order-4 ${linkClass}`}
            >
                隐私政策
            </button>

            <span aria-hidden="true" className={`order-8 pc:order-7 ${separatorClass}`}>|</span>

            <button
                type="button"
                onClick={() => setLegalDoc("terms")}
                aria-haspopup="dialog"
                className={`order-9 pc:order-6 ${linkClass}`}
            >
                服务条款
            </button>

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
