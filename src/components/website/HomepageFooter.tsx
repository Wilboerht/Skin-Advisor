"use client";

import { Link } from "next-view-transitions";
import Image from "next/image";

/**
 * HomepageFooter — 首页页脚（版权 + 政策链接 + 备案）
 * 浅色低存在感：桌面端固定屏幕底部、备案居左/链接与版权居右，移动端左对齐自然折行（留在 Dock 上方）
 */
export function HomepageFooter() {
    const separator = <span aria-hidden="true" className="text-brand-charcoal/20">|</span>;

    return (
        <footer className="w-full flex flex-col items-start gap-2.5 text-[11px] font-light tracking-[0.12em] text-brand-charcoal/25 md:flex-row md:items-center md:justify-between">
            {/* 备案信息组 */}
            <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1.5">
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
            </div>

            {/* 政策链接 + 版权组 */}
            <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1.5">
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
            </div>
        </footer>
    );
}
