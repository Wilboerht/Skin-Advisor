import Link from "next/link";
import Image from "next/image";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * 全站共享页脚：版权 + 隐私政策/服务条款 + ICP 备案 + 公网安备。
 * 移动端同样展示全部链接（小字号排版），文字对比度满足 WCAG AA。
 * 首页全屏布局使用独立的 HomepageFooter（样式由 globals.css 的 .home-footer 控制）。
 */
export function SiteFooter() {
  return (
    <footer className="pt-6 md:pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] px-6 text-center">
      <div className="flex flex-col items-center justify-center gap-2 text-xs font-light text-brand-charcoal/70 tracking-[0.12em]">
        {/* 版权与政策链接同一行（窄屏自动换行居中） */}
        <nav aria-label="法律信息" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <p suppressHydrationWarning>© {CURRENT_YEAR} NIHPLOD. All Rights Reserved.</p>
          <span aria-hidden="true" className="text-brand-charcoal/30">·</span>
          <Link href="/privacy" className="transition-colors duration-300 hover:text-brand-charcoal">
            隐私政策
          </Link>
          <span aria-hidden="true" className="text-brand-charcoal/30">·</span>
          <Link href="/terms" className="transition-colors duration-300 hover:text-brand-charcoal">
            服务条款
          </Link>
        </nav>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-300 hover:text-brand-charcoal"
          >
            沪ICP备2026014764号-1
          </a>
          <span aria-hidden="true" className="hidden sm:inline text-brand-charcoal/30">|</span>
          <a
            href="http://www.beian.gov.cn/portal/registerSystemInfo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors duration-300 hover:text-brand-charcoal"
          >
            <Image src="/images/beian.webp" alt="" width={12} height={12} className="shrink-0 opacity-80" />
            <span>沪公网安备31010702010178号</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
