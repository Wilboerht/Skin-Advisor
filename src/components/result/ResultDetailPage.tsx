"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sun, Home, ShoppingBag, SoapDispenserDroplet, Info, ArrowRight } from "lucide-react";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
import Threads from "@/components/ui/Threads";
import type { SkinTypeData } from "@/lib/result-content";
interface ResultDetailPageProps {
  data: SkinTypeData;
}

function formatParagraphs(text: string): React.ReactElement {
  const paragraphs = text.split("\n\n").filter((p) => p.trim());
  return (
    <>
      {paragraphs.map((p, i) => {
        const isSignature = p.trimStart().startsWith("——");
        return (
          <p
            key={i}
            className={`mb-5 last:mb-0 text-[#4A4A4A] leading-[1.85] text-base ${
              isSignature ? "text-right" : ""
            }`}
          >
            {p.trim()}
          </p>
        );
      })}
    </>
  );
}

export default function ResultDetailPage({ data }: ResultDetailPageProps) {
  const ingredientHeaders = useMemo(() => {
    if (!data.m7.ingredientTable.length) return [];
    return Object.keys(data.m7.ingredientTable[0]);
  }, [data.m7.ingredientTable]);

  return (
    <article className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A]">
      {/* 顶部导航 */}
      <WebsiteNavbar />

      {/* Hero */}
      <section
        className="relative min-h-[380px] md:min-h-[560px] px-6 md:px-12 lg:px-20 overflow-hidden bg-[#F8F7F3] text-[#1A1A1A]"
      >
        <div className="relative z-10 max-w-5xl mx-auto w-full pt-24 md:pt-28 pb-10 md:pb-14 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[0.95] mb-4 md:mb-5">
              {data.typeName}
            </h1>
            <p className="text-sm md:text-base opacity-80 font-light leading-[1.85] max-w-xl">
              {data.m1.persona}
            </p>
          </div>
<div className="relative w-full max-w-[180px] mx-auto lg:max-w-[260px] lg:ml-auto aspect-[3/4]">
            <Image
              src={`/images/character/${data.ipKey}/${data.ipKey}_female.png`}
              alt={`${data.typeName} 形象`}
              fill
              className="object-contain object-bottom"
              sizes="(max-width: 1024px) 280px, 320px"
              priority
            />
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="relative overflow-hidden py-14 px-6 md:px-12 lg:px-20 bg-white">
        <Threads
          className="hidden md:block absolute top-[40%] left-0 right-0 -translate-y-1/2 h-[95%] z-0 pointer-events-none"
          color={[0.941, 0.929, 0.882]}
          amplitude={1.5}
          distance={0}
          enableMouseInteraction={false}
        />
        <div className="relative z-10 max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-6 md:mb-10">
            {data.m5.title || "优势高光"}
          </h2>
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {data.m5.advantages.map((adv, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 md:p-8 shadow-sm border border-[#E8E2D9] hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#1B3A5C] text-white text-xs md:text-sm font-medium">
                    {i + 1}
                  </span>
                  <h3 className="text-base md:text-lg font-medium text-[#1A1A1A]">{adv.title}</h3>
                </div>
                <p className="text-[#5E5E5E] leading-[1.85] text-xs md:text-sm">{adv.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Skincare Formula */}
      <section className="py-14 px-6 md:px-12 lg:px-20 bg-[#F8F7F3]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-3 md:mb-4">
            {data.m7.title || `${data.typeName}的精准护肤公式`}
          </h2>
          {data.m7.formulaCore && (
            <p className="text-sm md:text-lg text-[#8A8A8A] font-light mb-6 md:mb-10 leading-[1.85]">
              {data.m7.formulaCore}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {data.m7.suggestions.map((sug, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-[#E8E2D9] flex flex-col">
                <span className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#1B3A5C] text-white text-xs md:text-sm font-medium mb-4">
                  {i + 1}
                </span>
                <h3 className="text-base font-medium text-[#1A1A1A] mb-3">{sug.title}</h3>
                <p className="text-[#5E5E5E] leading-[1.85] text-xs md:text-sm flex-1">{sug.content}</p>
              </div>
            ))}
          </div>

          {data.m7.ingredientTable.length > 0 && (
            <div className="overflow-x-auto mt-8 md:mt-12">
              <table className="w-full text-xs md:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#D9D0C3]">
                    {ingredientHeaders.map((h) => (
                      <th key={h} className="text-left py-2 px-2 md:py-3 md:px-4 font-semibold text-[#1B3A5C] uppercase tracking-wider text-[11px] md:text-sm">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.m7.ingredientTable.map((row, i) => (
                    <tr key={i} className="border-b border-[#E8E2D9] last:border-0 hover:bg-white/60">
                      {ingredientHeaders.map((h) => (
                        <td key={h} className="py-2 px-2 md:py-4 md:px-4 text-[#4A4A4A] font-light">
                          {h === "推荐产品" ? (
                            <a
                              href="https://nihplod.cn/products"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#1B3A5C] hover:text-[#A0784C] transition-colors duration-300"
                            >
                              {row[h]}
                            </a>
                          ) : (
                            row[h]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </section>

      {/* Daily Routine */}
      <section className="py-14 px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-5 md:mb-8">
            {data.m4.title || "我们建议的护肤日常"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { title: "优雅日常", subtitle: "每日精简守护", icon: Sun },
              { title: "居家仪式", subtitle: "DIY 悦己时光", icon: Home },
              { title: "单品好物", subtitle: "随时按需使用", icon: ShoppingBag },
              { title: "专业水疗", subtitle: "沉静式体验", icon: SoapDispenserDroplet },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <a
                  key={i}
                  href="https://nihplod.cn/guide"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center text-center bg-[#FAF9F6] rounded-xl p-4 md:p-5 border border-[#E8E2D9] hover:shadow-sm hover:border-[#C9A86C]/50 transition-all"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#E8E2D9] mb-3">
                    <Icon className="w-5 h-5 text-[#C9A86C] stroke-[1.25]" />
                  </div>
                  <h3 className="text-sm md:text-base font-medium text-[#1A1A1A] mb-1 group-hover:text-[#1B3A5C] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#8A8A8A] leading-relaxed">{item.subtitle}</p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-14 px-6 md:px-12 lg:px-20 bg-white">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-3 px-10 py-3.5 border border-[#1B3A5C] text-[#1B3A5C] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.15em] font-medium cursor-pointer transition-all duration-500 hover:bg-[#1B3A5C] hover:text-white"
          >
            <span>前往测肤</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
          </Link>
          <Link
            href="/gift"
            className="flex items-center justify-center gap-2 mt-5 text-[13px] sm:text-[14px] text-[#A0784C] tracking-[0.1em] font-medium hover:text-[#8B6840] transition-colors duration-300"
          >
            <Image
              src="/images/watermark.png"
              alt=""
              width={28}
              height={28}
              className="w-7 h-7 object-contain drop-shadow-[0_1px_1px_rgba(61,68,48,0.25)] animate-[soft-blink_3s_ease-in-out_infinite]"
              unoptimized
            />
            参与「肌智派」活动，抽奖赢好礼
          </Link>
        </div>
      </section>

      <style>{`
        @keyframes soft-blink {
          0%, 100% { opacity: 0.88; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Footer */}
      <footer className="pt-6 md:pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] px-6 text-center border-t border-[rgba(61,68,48,0.08)]">
        <p className="flex items-start justify-center gap-2 text-[10px] sm:text-xs text-[#8A8A8A] leading-[1.8] max-w-2xl mx-auto mb-4 md:mb-6">
          <Info className="w-3.5 h-3.5 text-[#C9A86C] flex-shrink-0 mt-0.5 stroke-[2]" />
          <span>
            该类型仅表示此综合评分下一般情况，不代表您的素颜测肤结果。请完成测试，以获取您的专属素颜分析报告。
          </span>
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-4 text-[10px] md:text-xs tracking-widest text-[#5E5E5E]/60">
          <p>© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
          <span className="hidden sm:inline text-[#5E5E5E]/30">·</span>
          <div className="hidden sm:flex items-center gap-4">
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
    </article>
  );
}
