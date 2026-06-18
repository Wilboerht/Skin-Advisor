import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle, ScanLine, HeadphonesIcon } from "lucide-react";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";

export const metadata: Metadata = {
  title: "更多服务 | NIHPLOD",
  description: "添加 NIHPLOD 专属护肤顾问微信，获取一对一素颜肌肤分析与护肤方案定制。",
};

const steps = [
  {
    icon: ScanLine,
    title: "扫码添加",
    desc: "微信扫描二维码，添加专属护肤顾问",
  },
  {
    icon: MessageCircle,
    title: "一对一沟通",
    desc: "发送肌肤照片与需求，获取专业分析",
  },
  {
    icon: HeadphonesIcon,
    title: "持续陪伴",
    desc: "顾问全程跟进，解答护肤疑问",
  },
];

export default function ServicesPage() {
  return (
    <main className="relative flex flex-col min-h-screen text-[#1A1A1A] bg-[#F8F7F3]">
      <WebsiteNavbar />

      <section className="flex-1 flex items-center pt-24 md:pt-28 pb-12 md:pb-16 px-6 md:px-12 lg:px-20">
        <div className="w-full max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
            {/* QR Code */}
            <div className="flex flex-col items-center md:items-end order-2 md:order-1">
              <div className="relative w-44 h-44 md:w-56 md:h-56 rounded-2xl overflow-hidden border border-[#3D4430]/10 bg-white p-4 shadow-sm">
                <Image
                  src="/images/advisor-qr.jpg"
                  alt="NIHPLOD 专属护肤顾问微信二维码"
                  fill
                  className="object-contain p-2"
                />
              </div>
              <p className="mt-4 text-xs md:text-sm text-[#5E5E5E] font-light tracking-wide">
                微信扫码 · 即刻咨询
              </p>
            </div>

            {/* Content */}
            <div className="text-center md:text-left order-1 md:order-2">
              <h1 className="text-2xl md:text-3xl font-serif text-[#3D4430] mb-3">
                线上顾问服务
              </h1>
              <p className="text-[#5E5E5E] font-light leading-relaxed mb-7 md:mb-8 text-sm md:text-[15px]">
                添加 NIHPLOD 专属护肤顾问微信，获取一对一素颜肌肤分析、产品推荐与护肤方案定制。顾问将根据您的肌肤状态、生活习惯与护肤目标，提供专业解答与专属建议。
              </p>

              {/* Steps */}
              <div className="space-y-4 md:space-y-5">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F5F2ED] flex items-center justify-center text-[#8B7355] shrink-0">
                      <step.icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-[14px] font-medium text-[#3D4430]">
                        {step.title}
                      </h3>
                      <p className="text-[12px] text-[#5E5E5E] font-light leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="py-5 md:py-6 px-6 text-center border-t border-[rgba(61,68,48,0.08)]">
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
