"use client";

import { Link } from "next-view-transitions";
import Image from "next/image";

/**
 * HomepageFooter — 首页页脚（版权 + 政策链接 + 备案）
 * 浅色低存在感。宽屏（≥1440px）：备案居左、链接与版权居右（ICP 的 mr-auto 形成左右两组），单行排列。
 * 窄屏（<1440px）：居中两行——第一行 公安备案 | 版权，第二行 ICP备案 | 隐私政策 | 服务条款；
 * 通过 flex order 重排实现，宽屏顺序与分组不变。
 */
export function HomepageFooter() {
    const linkClass = "flex !min-h-0 !min-w-0 items-center hover:text-brand-charcoal/60 transition-colors";
    const separatorClass = "text-brand-charcoal/40 select-none";

    return (
        <footer className="w-full flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-light tracking-[0.12em] text-brand-charcoal/70 min-[1440px]:flex-nowrap min-[1440px]:justify-start">
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
            <p suppressHydrationWarning className="order-3 min-[1440px]:order-8">
                <span className="hidden min-[1440px]:inline">&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</span>
                <span className="min-[1440px]:hidden">&copy; {new Date().getFullYear()} NIHPLOD</span>
            </p>

            {/* 窄屏断行（宽屏不渲染） */}
            <div aria-hidden="true" className="order-4 basis-full h-0 min-[1440px]:hidden" />

            {/* ICP 备案：窄屏第二行首，宽屏左组第二；mr-auto 把后续项推到右侧形成右组 */}
            <Link
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className={`order-5 min-[1440px]:order-3 min-[1440px]:mr-auto ${linkClass}`}
            >
                沪ICP备2026014764号-1
            </Link>

            <span aria-hidden="true" className={`order-6 min-[1440px]:order-5 ${separatorClass}`}>|</span>

            <Link href="/privacy" className={`order-7 min-[1440px]:order-4 ${linkClass}`}>
                隐私政策
            </Link>

            <span aria-hidden="true" className={`order-8 min-[1440px]:order-7 ${separatorClass}`}>|</span>

            <Link href="/terms" className={`order-9 min-[1440px]:order-6 ${linkClass}`}>
                服务条款
            </Link>
        </footer>
    );
}
