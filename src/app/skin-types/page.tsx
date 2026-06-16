import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { skinTypes, routeOrder } from "@/lib/result-content";

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
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 lg:px-20 py-6 md:py-7 bg-[#F5F2E9]/80 backdrop-blur-md border-b border-[rgba(61,68,48,0.06)] transition-colors duration-500">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="cursor-pointer">
            <Image
              src="/NIHPLOD-logo.svg"
              alt="NIHPLOD"
              width={120}
              height={36}
              className="h-8 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-500"
            />
          </Link>
          <Link
            href="/"
            className="group flex items-center gap-2 text-sm font-medium tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] transition-colors duration-500"
          >
            <span className="hidden sm:inline">返回首页</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-40 pb-20 md:pt-56 md:pb-28 px-6 md:px-12 lg:px-20 overflow-hidden">
        {/* 装饰弧线 */}
        <svg
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-auto opacity-[0.04] pointer-events-none"
          viewBox="0 0 800 400"
          fill="none"
        >
          <path
            d="M-100 200c200-120 500-120 800 0"
            stroke="#3D4430"
            strokeWidth="1"
          />
          <path
            d="M-100 240c200-100 500-100 800 0"
            stroke="#3D4430"
            strokeWidth="0.8"
          />
        </svg>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p
            className="text-xs uppercase tracking-[0.3em] text-[#8B7355] mb-5 opacity-0 animate-fade-in-up"
            style={{ animationFillMode: "forwards" }}
          >
            NIHPLOD Skin Archetypes
          </p>
          <h1
            className="text-4xl md:text-6xl font-serif text-[#1A1A1A] font-normal tracking-tight mb-7 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}
          >
            肌肤测试结果类型
          </h1>
          <p
            className="text-base md:text-lg text-[#5E5E5E] font-light max-w-2xl mx-auto leading-relaxed opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}
          >
            10种摩纳哥臻奢护肤人格，从进阶狂魔到御龄主宰。每一种肌肤状态，都值得被认真书写。
          </p>
        </div>
      </section>

      {/* 类型卡片 */}
      <section className="pb-24 md:pb-32 px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-5">
          {orderedTypes.map((type, i) => {
            if (!type) return null;
            return (
              <Link
                key={type.route}
                href={`/result/${type.route}`}
                className="group relative overflow-hidden rounded-2xl border border-[rgba(61,68,48,0.1)] bg-white/55 backdrop-blur-md p-7 md:p-9 transition-all duration-500 hover:shadow-[0_16px_32px_rgba(61,68,48,0.08)] hover:-translate-y-1"
              >
                <div className="absolute top-0 right-0 w-36 h-36 bg-[rgba(139,115,85,0.06)] rounded-bl-full transition-all duration-500 group-hover:scale-110 group-hover:bg-[rgba(139,115,85,0.1)]" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs uppercase tracking-[0.2em] text-[#8B7355]">
                      {type.scoreRange} 分
                    </span>
                    <span className="text-2xl font-light text-[#3D4430]/30">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif text-[#1A1A1A] mb-3 group-hover:text-[#3D4430] transition-colors duration-500">
                    {type.typeName}
                  </h2>
                  <p className="text-sm text-[#5E5E5E] leading-relaxed mb-6 line-clamp-2 font-light">
                    {type.m1.persona}
                  </p>
                  <div className="inline-flex items-center text-sm font-medium tracking-wide text-[#3D4430]/80 group-hover:text-[#3D4430] transition-colors duration-300">
                    查看完整解读
                    <ArrowRight className="w-4 h-4 ml-1.5 transition-transform duration-500 group-hover:translate-x-1" />
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
      <footer className="py-12 px-6 text-center border-t border-[rgba(61,68,48,0.1)]">
        <p className="text-[11px] tracking-widest text-[#5E5E5E]/70">
          NIHPLOD 旎柏 · 源自摩纳哥的臻奢功效型护肤品牌
        </p>
      </footer>
    </main>
  );
}
