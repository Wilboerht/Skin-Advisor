import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HeartHandshake, LineChart, Sparkles } from "lucide-react";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";

export const metadata: Metadata = {
  title: "顾问服务 | NIHPLOD",
  description: "添加 NIHPLOD 护肤顾问微信，获取一对一护肤建议。",
};

export default function ServicesPage() {
  return (
    <main className="relative flex flex-col min-h-screen text-[#1A1A1A] bg-[#F8F7F3]">
      <WebsiteNavbar />

      <section className="flex-1 flex items-center px-6 md:px-12 lg:px-20 pt-28 md:pt-24 pb-20">
        <div className="w-full max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-12 lg:gap-20 items-center">
            {/* 左侧文字 */}
            <div className="order-2 lg:order-1">
              <h1 className="text-2xl md:text-3xl font-serif text-[#1A1A1A] leading-[1.1] mb-8">
                顾问服务
              </h1>
              <p className="text-[15px] md:text-base text-[#5E5E5E] font-light leading-relaxed max-w-lg mb-8">
                如果你希望获得更具体的护肤建议，可以添加 NIHPLOD 护肤顾问微信，与顾问一对一沟通。
              </p>

              <div className="grid grid-cols-3 gap-5 max-w-lg">
                {[
                  { icon: HeartHandshake, text: "专属顾问" },
                  { icon: LineChart, text: "跟踪调整" },
                  { icon: Sparkles, text: "定制方案" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-[#3D4430]">
                    <Icon className="w-4 h-4 text-[#3D4430]" strokeWidth={1.5} />
                    <span className="text-sm font-light tracking-wide">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧二维码 */}
            <div className="order-1 lg:order-2 flex justify-start lg:justify-end">
              <div className="inline-block text-center">
                <div className="relative w-44 h-44 md:w-60 md:h-60 bg-white rounded-2xl p-5 mb-4 shadow-[0_4px_24px_rgba(61,68,48,0.08)]">
                  <Image
                    src="/images/advisor-qr.jpg"
                    alt="NIHPLOD 护肤顾问微信二维码"
                    fill
                    sizes="(max-width: 768px) 176px, 208px"
                    loading="eager"
                    className="object-contain p-3"
                  />
                </div>
                <p className="text-[12px] text-[#5E5E5E] font-light tracking-[0.1em]">
                  微信扫码 · 添加顾问
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="py-8 px-6 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs tracking-widest text-[#5E5E5E]/60">
          <p>© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
          <span className="hidden sm:inline text-[#5E5E5E]/30">·</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#3D4430] transition-colors duration-300">
              隐私政策
            </Link>
            <span className="text-[#5E5E5E]/30">·</span>
            <Link href="/terms" className="hover:text-[#3D4430] transition-colors duration-300">
              服务条款
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
