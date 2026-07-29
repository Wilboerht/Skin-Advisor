"use client";

import { m } from "framer-motion";
import { Link } from "next-view-transitions";
import Image from "next/image";

export function HomepageFooter() {
    return (
        <m.footer
            className="home-footer w-full mt-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 1 }}
        >
            <p className="footer-copyright relative z-10">
                &copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
            </p>

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
        </m.footer>
    );
}
