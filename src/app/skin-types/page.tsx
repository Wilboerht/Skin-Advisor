import type { Metadata } from "next";
import Link from "next/link";
import { skinTypes, routeOrder } from "@/lib/result-content";

export const metadata: Metadata = {
  title: "肌肤测试结果类型 | NIHPLOD",
  description: "探索10种NIHPLOD肌肤测试结果类型，从进阶狂魔到御龄主宰。",
};

const scoreColors = [
  "from-[#1B3A5C] to-[#F5F1EB]",
  "from-[#0A1628] to-[#E8E4E0]",
  "from-[#7EB5D6] to-[#FAF8F5]",
  "from-[#F0EDE6] to-[#D4AF7A]",
  "from-[#7A8B99] to-[#F5F1EB]",
  "from-[#1B4965] to-[#5FA8D3]",
  "from-[#C9A86C] to-[#1B3A5C]",
  "from-[#0A1628] to-[#E8D5D0]",
  "from-[#B8C4CE] to-[#F5F0E8]",
  "from-[#0A1628] to-[#C9A96E]",
];

export default function ResultIndexPage() {
  const orderedTypes = routeOrder
    .map((route) => skinTypes.find((t) => t.route === route))
    .filter(Boolean);

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A]">
      <section className="relative py-24 md:py-32 px-6 md:px-12 lg:px-20 bg-[#1B3A5C] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 50 Q25 30 50 50 T100 50 V100 H0 Z" fill="currentColor" />
          </svg>
        </div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-4">NIHPLOD Skin Archetypes</p>
          <h1 className="text-4xl md:text-6xl font-light tracking-tight mb-6">
            肌肤测试结果类型
          </h1>
          <p className="text-lg text-white/80 font-light max-w-2xl mx-auto leading-relaxed">
            10种摩纳哥臻奢护肤人格，从进阶狂魔到御龄主宰。每一种肌肤状态，都值得被认真书写。
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
          {orderedTypes.map((type, i) => {
            if (!type) return null;
            return (
              <Link
                key={type.route}
                href={`/result/${type.route}`}
                className="group relative overflow-hidden rounded-2xl border border-[#E8E2D9] bg-white p-8 md:p-10 transition-all duration-500 hover:shadow-xl hover:-translate-y-1"
              >
                <div
                  className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${scoreColors[i]} opacity-20 rounded-bl-full transition-opacity group-hover:opacity-30`}
                />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs uppercase tracking-[0.2em] text-[#8A8A8A]">
                      {type.scoreRange} 分
                    </span>
                    <span className="text-2xl font-light text-[#C9A86C]">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-light text-[#1A1A1A] mb-3 group-hover:text-[#1B3A5C] transition-colors">
                    {type.typeName}
                  </h2>
                  <p className="text-sm text-[#5E5E5E] leading-relaxed mb-6 line-clamp-2">
                    {type.m1.persona}
                  </p>
                  <div className="inline-flex items-center text-sm font-medium text-[#1B3A5C] group-hover:underline">
                    查看完整解读
                    <svg
                      className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="py-12 px-6 text-center text-xs text-[#8A8A8A] border-t border-[#E8E2D9]">
        <p>NIHPLOD 旎柏 · 源自摩纳哥的臻奢功效型护肤品牌</p>
      </footer>
    </main>
  );
}
