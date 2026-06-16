import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
    <main className="relative min-h-screen text-[#1A1A1A]">
      {/* 顶部导航 */}
      <WebsiteNavbar />

      {/* Hero */}
      <section className="relative pt-32 pb-12 md:pt-40 md:pb-16 px-6 md:px-12 lg:px-20 overflow-hidden">
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1
            className="text-2xl md:text-3xl font-serif text-[#1A1A1A] mb-4 opacity-0 animate-fade-in-up"
            style={{ animationFillMode: "forwards" }}
          >
            发现你的肌肤性格类型
          </h1>
          <p
            className="text-[15px] md:text-base text-[#5E5E5E] font-light max-w-xl mx-auto leading-relaxed mb-5 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}
          >
            每一种肌肤，都有自己的性格。从素颜状态出发，读懂肌肤真正需要什么。
          </p>
          <Link
            href="/"
            className="group relative inline-flex items-center justify-center gap-4 px-12 py-4 sm:px-16 border border-[#3D4430]/25 hover:border-[#3D4430]/50 hover:bg-[#3D4430]/[0.03] text-[13px] sm:text-[14px] tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] font-medium cursor-pointer transition-all duration-500 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}
          >
            <span>前往测肤</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
          </Link>
        </div>
      </section>

      {/* 类型卡片 */}
      <section className="pb-24 md:pb-32 px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-5">
          {orderedTypes.map((type, i) => {
            if (!type) return null;
            return (
              <Link
                key={type.route}
                href={`/result/${type.route}`}
                className="group relative rounded-2xl border border-[rgba(61,68,48,0.1)] bg-white/55 backdrop-blur-md p-7 md:p-9 transition-all duration-500 hover:shadow-[0_16px_32px_rgba(61,68,48,0.08)] hover:-translate-y-1"
              >
                <Image
                  src="/images/gender-decoration.svg"
                  alt=""
                  width={160}
                  height={260}
                  className="absolute -right-3 -bottom-14 w-36 h-64 md:w-48 md:h-80 object-contain opacity-100 group-hover:scale-105 transition-transform duration-500 pointer-events-none select-none"
                />
                <div className="relative z-10">
                  <h2 className="text-xl md:text-2xl font-serif tracking-wide text-[#1A1A1A] mb-2 group-hover:text-[#3D4430] transition-colors duration-500">
                    {type.typeName}
                  </h2>
                  <p className="text-xs text-[#5E5E5E] leading-relaxed mb-5 line-clamp-2 font-light">
                    {type.m1.persona}
                  </p>
                  <div className="inline-flex items-center text-xs font-medium tracking-wide text-[#3D4430]/80 group-hover:text-[#3D4430] transition-colors duration-300">
                    查看完整解读
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform duration-500 group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 返回 CTA */}
      <section className="pb-20 md:pb-28 px-6 text-center">
        <Link
          href="/"
          className="group inline-flex items-center gap-3 text-[13px] sm:text-[14px] tracking-[0.2em] text-[#3D4430]/60 hover:text-[#3D4430] font-medium transition-colors duration-500"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-500 group-hover:-translate-x-1" />
          <span>返回测肤首页</span>
        </Link>
      </section>

      {/* 页脚 */}
      <footer className="py-8 px-6 text-center border-t border-[rgba(61,68,48,0.08)]">
        <p className="text-[11px] tracking-widest text-[#5E5E5E]/60">
          © {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
        </p>
      </footer>
    </main>
  );
}
