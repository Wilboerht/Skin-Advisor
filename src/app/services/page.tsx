import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { Link as ViewTransitionLink } from "next-view-transitions";
import { ScanLine, MessageCircle, HeadphonesIcon, ArrowRight, CheckCircle2, Headset } from "lucide-react";
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

const outcomes = [
  "一份专属肌肤评估报告",
  "个性化护肤方案与产品清单",
  "一对一顾问长期陪伴",
  "动态调整建议与进度追踪",
  "更多惊喜，期待解锁......",
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

      <section className="flex-1 flex flex-col justify-center pt-16 md:pt-20 pb-5 md:pb-6 px-6 md:px-12 lg:px-20">
        <div className="w-full max-w-5xl mx-auto text-center">
          {/* Headline */}
          <div className="mb-[80px]">
            <div className="flex justify-center mb-4 text-[#1B3A5C]">
              <Headset className="w-8 h-8" />
            </div>
            <h1 className="text-2xl md:text-3xl font-serif text-[#1A1A1A] mb-4 leading-tight tracking-tight">
              通过专业顾问评估
              <br className="hidden md:block" />
              更好地了解你的肌肤
            </h1>
            <p className="text-[15px] md:text-base text-[#5E5E5E] font-light leading-snug max-w-2xl mx-auto mb-5">
              NIHPLOD 专属护肤顾问将结合你的 AI 测肤结果、日常习惯与护肤目标，提供一对一深度评估与长期陪伴。
            </p>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 lg:gap-8 items-start mb-[80px]">
            {/* Benefits */}
            <div className="text-left order-1">
              <h2 className="text-[15px] md:text-base font-medium text-[#1B3A5C] mb-3 tracking-wide">
                顾问评估包含
              </h2>
              <ul className="space-y-2 mb-5">
                {benefits.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#1B3A5C] mt-0.5 shrink-0" />
                    <span className="text-[13px] md:text-[14px] text-[#5E5E5E] font-light leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
              <ViewTransitionLink
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B3A5C] text-white text-[12px] md:text-[13px] tracking-[0.1em] rounded-full hover:bg-[#1B3A5C]/90 transition-all duration-300 hover:shadow-lg hover:shadow-[#1B3A5C]/10 hover:-translate-y-0.5"
              >
                先进行 AI 测肤
                <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </ViewTransitionLink>
            </div>

            {/* Outcomes */}
            <div className="text-left order-2">
              <h2 className="text-[15px] md:text-base font-medium text-[#1B3A5C] mb-3 tracking-wide">
                您将得到什么
              </h2>
              <ul className="space-y-2">
                {outcomes.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#1B3A5C] mt-0.5 shrink-0" />
                    <span className="text-[13px] md:text-[14px] text-[#5E5E5E] font-light leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center md:items-end order-3">
              <div className="flex flex-col items-center">
                <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-2xl overflow-hidden border border-[#1B3A5C]/10 bg-white p-4 shadow-sm">
                  <Image
                    src="/images/advisor-qr.jpg"
                    alt="NIHPLOD 专属护肤顾问微信二维码"
                    fill
                    className="object-contain p-2"
                  />
                </div>
                <p className="mt-3 text-xs md:text-[13px] text-[#5E5E5E] font-light tracking-wide text-center">
                  微信扫码 · 添加专属顾问
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="max-w-2xl mx-auto">
            {/* Desktop: 3 steps with two separate connecting lines */}
            <div className="hidden md:grid grid-cols-5 items-center gap-0">
              {steps.map((step, i) => (
                <Fragment key={i}>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-9 h-9 rounded-full bg-[#EDF1F7] border border-[#1B3A5C]/5 flex items-center justify-center text-[#1B3A5C]">
                      <step.icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-[14px] font-medium text-[#1A1A1A] mt-3 mb-1">
                      {step.title}
                    </h3>
                    <p className="text-[12px] text-[#5E5E5E] font-light leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="h-[1px] bg-[#1B3A5C]/10 w-full" />
                  )}
                </Fragment>
              ))}
            </div>

            {/* Mobile: vertical stack */}
            <div className="flex flex-col md:hidden gap-4">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#EDF1F7] border border-[#1B3A5C]/5 flex items-center justify-center text-[#1B3A5C] shrink-0">
                    <step.icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-medium text-[#1A1A1A] mb-0">
                      {step.title}
                    </h3>
                    <p className="text-[11px] text-[#5E5E5E] font-light leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="py-4 md:py-5 px-6 text-center border-t border-[rgba(27,58,92,0.08)]">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs tracking-widest text-[#5E5E5E]/60">
          <p>© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
          <span className="hidden sm:inline text-[#5E5E5E]/30">·</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#1B3A5C] transition-colors duration-300">
              隐私政策
            </Link>
            <span className="text-[#5E5E5E]/30">·</span>
            <Link href="/terms" className="hover:text-[#1B3A5C] transition-colors duration-300">
              服务条款
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
