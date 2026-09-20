"use client";

import { Link } from "next-view-transitions";
import Image from "next/image";

/**
 * HomepageFooter — 首页页脚（版权 + 政策链接 + 备案）
 * 浅色低存在感。桌面端（md+）：备案居左、链接与版权居右（ICP 的 mr-auto 形成左右两组），单行排列。
 * 移动端：居中两行——第一行 公安备案 | 版权，第二行 ICP备案 | 隐私政策 | 服务条款；
 * 通过 flex order 重排实现，桌面端顺序与分组不变。
 */
export function HomepageFooter() {
    const linkClass = "flex !min-h-0 !min-w-0 items-center hover:text-brand-charcoal/60 transition-colors";
    const separatorClass = "text-brand-charcoal/40 select-none";

    return (
        <footer className="w-full flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-light tracking-[0.12em] text-brand-charcoal/70 md:flex-nowrap md:justify-start">
            {/* 公安备案：移动端第一行左，桌面端左组第一 */}
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

            {/* 版权：移动端第一行右，桌面端右组最后；移动端用简写避免拥挤，
                年份跨年瞬间 SSR/CSR 会不一致，抑制 hydration 告警 */}
            <p suppressHydrationWarning className="order-3 md:order-8">
                <span className="hidden sm:inline">&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</span>
                <span className="sm:hidden">&copy; {new Date().getFullYear()} NIHPLOD</span>
            </p>

            {/* 移动端断行（桌面端不渲染） */}
            <div aria-hidden="true" className="order-4 basis-full h-0 md:hidden" />

            {/* ICP 备案：移动端第二行首，桌面端左组第二；md:mr-auto 把后续项推到右侧形成右组 */}
            <Link
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className={`order-5 md:order-3 md:mr-auto ${linkClass}`}
            >
                沪ICP备2026014764号-1
            </Link>

            <span aria-hidden="true" className={`order-6 md:order-5 ${separatorClass}`}>|</span>

            <Link href="/privacy" className={`order-7 md:order-4 ${linkClass}`}>
                隐私政策
            </Link>

            <span aria-hidden="true" className={`order-8 md:order-7 ${separatorClass}`}>|</span>

            <Link href="/terms" className={`order-9 md:order-6 ${linkClass}`}>
                服务条款
            </Link>
        </footer>
    );
}
