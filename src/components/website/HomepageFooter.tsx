"use client";

import { Link } from "next-view-transitions";
import Image from "next/image";

/**
 * HomepageFooter — 首页页脚（版权 + 政策链接 + 备案）
 * 浅色低存在感、屏幕左对齐：桌面端固定在左下角（悬浮 Dock 之下），移动端留在 Dock 上方
 * 顺序：公网安备 → ICP → 隐私政策/服务条款 → 版权；窄屏自然折行
 */
export function HomepageFooter() {
    const separator = <span aria-hidden="true" className="text-brand-charcoal/20">|</span>;

    return (
        <footer className="w-full flex flex-wrap items-center justify-start gap-x-3 gap-y-1.5 text-[11px] font-light tracking-[0.12em] text-brand-charcoal/25">
            <Link
                href="http://www.beian.gov.cn/portal/registerSystemInfo"
                target="_blank"
                rel="noopener noreferrer"
                className="flex !min-h-0 !min-w-0 items-center gap-1 hover:text-brand-charcoal/60 transition-colors"
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

            {separator}

            <Link
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex !min-h-0 !min-w-0 items-center hover:text-brand-charcoal/60 transition-colors"
            >
                沪ICP备2026014764号-1
            </Link>

            {separator}

            <Link href="/privacy" className="flex !min-h-0 !min-w-0 items-center hover:text-brand-charcoal/60 transition-colors">
                隐私政策
            </Link>

            {separator}

            <Link href="/terms" className="flex !min-h-0 !min-w-0 items-center hover:text-brand-charcoal/60 transition-colors">
                服务条款
            </Link>

            {separator}

            {/* 移动端版权用简写避免拥挤 */}
            <p>
                <span className="hidden sm:inline">&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</span>
                <span className="sm:hidden">&copy; {new Date().getFullYear()} NIHPLOD</span>
            </p>
        </footer>
    );
}
