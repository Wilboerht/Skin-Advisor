"use client";

import { Link } from "next-view-transitions";
import Image from "next/image";

/**
 * HomepageFooter — 首页页脚（版权 + 政策链接 + 备案）
 * 样式自包含（Tailwind），不依赖 globals.css 中已随首页改版移除的 .home-container 作用域
 */
export function HomepageFooter() {
    return (
        <footer className="w-full flex flex-col items-center gap-2.5 text-[11px] font-light tracking-[0.12em] text-brand-charcoal/70">
            {/* 版权与政策链接同一行；移动端版权用简写避免拥挤 */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
                <p>
                    <span className="hidden sm:inline">&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</span>
                    <span className="sm:hidden">&copy; {new Date().getFullYear()} NIHPLOD</span>
                </p>

                <span aria-hidden="true" className="text-brand-charcoal/30">|</span>

                <Link href="/privacy" className="flex !min-h-0 !min-w-0 items-center hover:text-brand-charcoal transition-colors">
                    隐私政策
                </Link>

                <span aria-hidden="true" className="text-brand-charcoal/30">|</span>

                <Link href="/terms" className="flex !min-h-0 !min-w-0 items-center hover:text-brand-charcoal transition-colors">
                    服务条款
                </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
                <Link
                    href="https://beian.miit.gov.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex !min-h-0 !min-w-0 items-center hover:text-brand-charcoal transition-colors"
                >
                    沪ICP备2026014764号-1
                </Link>

                <span aria-hidden="true" className="text-brand-charcoal/30">|</span>

                <Link
                    href="http://www.beian.gov.cn/portal/registerSystemInfo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex !min-h-0 !min-w-0 items-center gap-1 hover:text-brand-charcoal transition-colors"
                >
                    <Image
                        src="/images/beian.webp"
                        alt=""
                        width={12}
                        height={12}
                        className="shrink-0 opacity-80"
                    />
                    <span>沪公网安备31010702010178号</span>
                </Link>
            </div>
        </footer>
    );
}
