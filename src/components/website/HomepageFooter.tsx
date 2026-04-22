"use client";

import { m } from "framer-motion";
import { Link } from "next-view-transitions";
import Image from "next/image";

export function HomepageFooter() {
    return (
        <m.div
            className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-4 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 1 }}
        >
            {/* 1. 版权文本 & 备案信息栏 */}
            <div className="flex flex-col items-center gap-1 opacity-40 pointer-events-auto">
                {/* 版权声明 */}
                <p className="text-[10px] sm:text-[11px] font-light tracking-widest text-[#1A1A1A] relative z-10 leading-tight">
                    &copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
                </p>

                {/* 备案号栏 */}
                <div className="flex items-center justify-center gap-2 sm:gap-4 text-[9px] sm:text-[10px] font-light tracking-normal sm:tracking-widest text-[#1A1A1A] whitespace-nowrap flex-nowrap leading-tight">
                    {/* ICP 备案 */}
                    <Link
                        href="https://beian.miit.gov.cn/"
                        target="_blank"
                        className="!min-h-0 !min-w-0 hover:text-brand-gold transition-colors flex items-center"
                    >
                        沪ICP备2026014764号-1
                    </Link>

                    {/* 公安网备暂时隐藏，待备案完成后恢复 */}
                    {/* <span className="text-[#1A1A1A]/30">|</span>

                    <Link
                        href="http://www.beian.gov.cn/portal/registerSystemInfo"
                        target="_blank"
                        className="!min-h-0 !min-w-0 hover:text-brand-gold transition-colors flex items-center gap-1"
                    >
                        <Image
                            src="/images/beian.webp"
                            alt="备案图标"
                            width={12}
                            height={12}
                            className="shrink-0 opacity-80"
                        />
                        <span>沪公网安备 xxxx号</span>
                    </Link> */}
                </div>
            </div>
        </m.div>
    );
}
