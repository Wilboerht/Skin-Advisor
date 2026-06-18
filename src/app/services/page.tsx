import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Link as ViewTransitionLink } from "next-view-transitions";
import { ScanLine, MessageCircle, HeadphonesIcon, ArrowRight, CheckCircle2 } from "lucide-react";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";

export const metadata: Metadata = {
  title: "更多服务 | NIHPLOD",
  description: "通过 NIHPLOD 专业顾问评估，更好地了解你的肌肤，获取一对一护肤建议。",
};

const benefits = [
  "深度解读肌肤状态与潜在问题",
  "基于 AI 测肤结果的个性化建议",
  "一对一匹配适合你的产品与Routine",
  "长期跟进，动态调整护肤方案",
];

const steps = [
  {
    icon: ScanLine,
    title: "扫码添加",
    desc: "添加专属护肤顾问微信",
  },
  {
    icon: MessageCircle,
    title: "提交肌肤信息",
    desc: "发送照片与 AI 测肤结果",
  },
  {
    icon: HeadphonesIcon,
    title: "获得评估报告",
    desc: "顾问输出分析与护肤方案",
  },
];

export default function ServicesPage() {
  return (
    <main className="relative flex flex-col min-h-screen text-[#1A1A1A] bg-[#F8F7F3]">
      <WebsiteNavbar />

      <section className="flex-1 flex items-center pt-24 md:pt-28 pb-10 md:pb-12 px-6 md:px-12 lg:px-20">
        <div className="w-full max-w-4xl mx-auto text-center">
          {/* Headline */}
          <h1 className="text-2xl md:text-4xl font-serif text-[#3D4430] mb-4 leading-snug">
            通过专业顾问评估
            <br className="hidden md:block" />
            更好地了解你的肌肤
          </h1>
          <p className="text-[#5E5E5E] font-light leading-relaxed mb-8 md:mb-10 max-w-xl mx-auto text-sm md:text-[15px]">
            NIHPLOD 专属护肤顾问将结合你的 AI 测肤结果、日常习惯与护肤目标，提供一对一深度评估与长期陪伴。
          </p>

          {/* Main Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-start mb-10 md:mb-12">
            {/* QR Code */}
            <div className="flex flex-col items-center">
              <div className="relative w-44 h-44 md:w-52 md:h-52 rounded-2xl overflow-hidden border border-[#3D4430]/10 bg-white p-4 shadow-sm">
                <Image
                  src="/images/advisor-qr.jpg"
                  alt="NIHPLOD 专属护肤顾问微信二维码"
                  fill
                  className="object-contain p-2"
                />
              </div>
              <p className="mt-4 text-xs md:text-sm text-[#5E5E5E] font-light tracking-wide">
                微信扫码 · 添加专属顾问
              </p>
            </div>

            {/* Benefits */}
            <div className="text-left">
              <h2 className="text-[15px] font-medium text-[#3D4430] mb-4 tracking-wide">
                顾问评估包含
              </h2>
              <ul className="space-y-3 mb-6">
                {benefits.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#8B7355] mt-0.5 shrink-0" />
                    <span className="text-[14px] text-[#5E5E5E] font-light leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
              <ViewTransitionLink
                href="/questions"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3D4430] text-[#F8F7F3] text-[13px] tracking-[0.1em] rounded-full hover:bg-[#3D4430]/90 transition-all duration-300 hover:shadow-lg hover:shadow-[#3D4430]/10 hover:-translate-y-0.5"
              >
                先进行 AI 测肤
                <ArrowRight className="w-4 h-4" />
              </ViewTransitionLink>
            </div>
          </div>

          {/* Steps */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-center gap-6 md:gap-10 pt-8 md:pt-10 border-t border-[#3D4430]/8">
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
