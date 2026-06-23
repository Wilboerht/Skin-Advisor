import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import { skinTypes, routeOrder } from "@/lib/result-content";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";

export const metadata: Metadata = {
  title: "肌肤测试结果类型 | NIHPLOD",
  description: "探索10种NIHPLOD肌肤测试结果类型，从进阶狂魔到御龄主宰。",
};

export default function ResultIndexPage() {
  const orderedTypes = routeOrder
    .map((route) => skinTypes.find((t) => t.route === route))
    .filter(Boolean);

  return (
    <main className="relative min-h-screen text-[#1A1A1A] bg-[#F8F7F3]">
      {/* 顶部导航 */}
      <WebsiteNavbar />

      {/* Hero */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 px-6 md:px-12 lg:px-20 overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full bg-[#C9A86C]/[0.06] blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <p
            className="text-[11px] tracking-[0.25em] text-[#8B7355] uppercase mb-5 opacity-0 animate-fade-in-up"
            style={{ animationFillMode: "forwards" }}
          >
            10 Skin Types
          </p>
          <h1
            className="text-2xl md:text-3xl font-serif text-[#1A1A1A] mb-5 opacity-0 animate-fade-in-up"
            style={{ animationFillMode: "forwards" }}
          >
            发现你的肌肤形象类型
          </h1>
          <p
            className="text-[15px] md:text-base text-[#5E5E5E] font-light max-w-xl mx-auto leading-relaxed mb-[30px] opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}
          >
            每一种肌肤，都有自己的性格。从素颜状态出发，读懂肌肤真正需要什么。
          </p>
          <Link
            href="/"
            className="group relative inline-flex items-center justify-center gap-3 px-10 py-3.5 bg-[#1B3A5C] text-white text-[13px] sm:text-[14px] tracking-[0.15em] font-medium cursor-pointer transition-all duration-500 hover:bg-[#1B3A5C]/90 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}
          >
            <span>前往测肤</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
          </Link>
        </div>
      </section>

      {/* 类型卡片 */}
      <section className="pb-28 md:pb-36 px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-x-7 gap-y-10">
          {orderedTypes.map((type, i) => {
            if (!type) return null;
            return (
              <Link
                key={type.route}
                href={`/skin-types/${type.route}`}
                className="group relative rounded-2xl border border-[rgba(61,68,48,0.08)] bg-[#FAF9F6] p-7 md:p-9 transition-all duration-500 hover:shadow-[0_16px_32px_rgba(61,68,48,0.08)] hover:-translate-y-1"
              >
                <Image
                  src={`/images/character/${type.scoreRange}/${type.scoreRange}_female.png`}
                  alt=""
                  width={160}
                  height={260}
                  className="absolute -right-3 -bottom-4 w-32 h-56 md:w-36 md:h-64 object-contain opacity-100 group-hover:scale-105 transition-transform duration-500 pointer-events-none select-none"
                />
                <div className="relative z-10 pr-20 md:pr-20">
                  <h2 className="text-xl md:text-2xl font-serif tracking-wide text-[#1A1A1A] mb-2 group-hover:text-[#3D4430] transition-colors duration-500">
                    {type.typeName}
                  </h2>
                  <p className="text-sm text-[#5E5E5E]/70 leading-relaxed mb-5 line-clamp-1 font-light">
                    {type.m1.persona}
                  </p>
                  <div className="inline-flex items-center text-xs font-medium tracking-[0.15em] text-[#3D4430] group-hover:text-[#3D4430]/80 transition-colors duration-300">
                    查看完整解读
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform duration-500 group-hover:translate-x-1.5" />
                  </div>
                </div>
              </Link>
            );
          })}
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
