"use client";

import { Link } from "next-view-transitions";
import Image from "next/image";

export function HomepageFooter() {
    return (
        <footer className="home-footer w-full mt-auto">
            {/* 版权与政策链接同一行；移动端版权用简写避免拥挤 */}
            <div className="footer-beian">
                <p className="footer-copyright relative z-10">
                    <span className="hidden sm:inline">&copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</span>
                    <span className="sm:hidden">&copy; {new Date().getFullYear()} NIHPLOD</span>
                </p>

                <span aria-hidden="true">|</span>

                <Link href="/privacy" className="flex !min-h-0 !min-w-0 items-center">
                    隐私政策
                </Link>

                <span aria-hidden="true">|</span>

                <Link href="/terms" className="flex !min-h-0 !min-w-0 items-center">
                    服务条款
                </Link>
            </div>

            <div className="footer-beian">
                <Link
                    href="https://beian.miit.gov.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex !min-h-0 !min-w-0 items-center"
                >
                    沪ICP备2026014764号-1
                </Link>

                <span aria-hidden="true">|</span>

                <Link
                    href="http://www.beian.gov.cn/portal/registerSystemInfo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex !min-h-0 !min-w-0 items-center gap-1"
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
