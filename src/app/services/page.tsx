import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HeartHandshake, LineChart, Sparkles } from "lucide-react";
import { withDefaultOgImage } from "@/lib/metadata";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
import { BreadcrumbSchema } from "@/components/website/StructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

export const metadata: Metadata = withDefaultOgImage({
  title: "顾问服务",
  description:
    "添加 NIHPLOD 护肤顾问微信，获取一对一专业护肤建议。专属顾问根据你的肤质类型量身定制护肤方案，持续跟踪调整。",
  keywords: ["护肤顾问", "一对一咨询", "皮肤管理", "NIHPLOD", "微信顾问"],
  alternates: { canonical: "/services" },
  openGraph: {
    title: "顾问服务 | NIHPLOD",
    description: "添加 NIHPLOD 护肤顾问微信，获取一对一专业护肤建议。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "顾问服务 | NIHPLOD",
    description: "添加 NIHPLOD 护肤顾问微信，获取一对一专业护肤建议。",
  },
});

export const revalidate = 86400;

export default function ServicesPage() {
  return (
    <main className="relative flex flex-col h-dvh overflow-hidden text-[#1A1A1A] bg-[#F8F7F3]">
      <BreadcrumbSchema
        items={[
          { name: "首页", url: BASE_URL },
          { name: "顾问服务", url: `${BASE_URL}/services` },
        ]}
      />
      <WebsiteNavbar />

      <section className="flex-1 flex items-center px-6 md:px-12 lg:px-20 pt-24 md:pt-28 pb-10 md:pb-20 min-h-0">
        <div className="w-full max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-8 md:gap-12 lg:gap-20 items-center">
            {/* 左侧文字 */}
            <div>
              <h1 className="text-xl md:text-3xl font-serif text-[#1A1A1A] leading-[1.1] mb-4 md:mb-8">
                顾问服务
              </h1>
              <p className="text-[13px] md:text-base text-[#5E5E5E] font-light leading-relaxed max-w-lg mb-4 md:mb-8">
                如需获得更具针对性的护肤建议，欢迎添加 NIHPLOD 护肤顾问微信，由专业顾问为您提供一对一咨询服务。
              </p>

              <div className="grid grid-cols-3 gap-3 md:gap-5 max-w-lg">
                {[
                  { icon: HeartHandshake, text: "专属顾问" },
                  { icon: LineChart, text: "跟踪调整" },
                  { icon: Sparkles, text: "定制方案" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 md:gap-3 text-[#3D4430]">
                    <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#3D4430]" strokeWidth={1.5} />
                    <span className="text-xs md:text-sm font-light tracking-wide">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧二维码 */}
            <div className="flex justify-start lg:justify-end">
              <div className="inline-block text-left md:text-center">
                <div className="relative w-36 h-36 md:w-52 md:h-52 lg:w-60 lg:h-60 bg-white rounded-2xl p-3 md:p-5 mb-3 md:mb-4 shadow-[0_4px_24px_rgba(61,68,48,0.08)]">
                  <Image
                    src="/images/advisor-qr.jpg"
                    alt="NIHPLOD 护肤顾问微信二维码"
                    fill
                    sizes="(max-width: 768px) 144px, (max-width: 1024px) 208px, 240px"
                    loading="eager"
                    className="object-contain p-2 md:p-3"
                  />
                </div>
                <p className="text-[10px] md:text-[12px] text-[#5E5E5E] font-light tracking-[0.1em]">
                  微信扫码 · 添加顾问
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="pt-4 md:pt-8 pb-[calc(1rem+env(safe-area-inset-bottom,16px))] md:pb-[calc(2rem+env(safe-area-inset-bottom,16px))] px-6 text-center shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-4 text-[10px] md:text-xs tracking-widest text-[#5E5E5E]/60">
          <p>© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
          <span className="hidden sm:inline text-[#5E5E5E]/30">·</span>
          <div className="hidden sm:flex items-center gap-4">
            <Link href="https://nihplod.cn/privacy" className="hover:text-[#3D4430] transition-colors duration-300">
                隐私政策
            </Link>
            <span className="text-[#5E5E5E]/30">·</span>
            <Link href="https://nihplod.cn/terms" className="hover:text-[#3D4430] transition-colors duration-300">
                服务条款
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
