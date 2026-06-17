"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Sun, Home, ShoppingBag, SoapDispenserDroplet, Info } from "lucide-react";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
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
        className="relative min-h-[520px] md:min-h-[560px] px-6 md:px-12 lg:px-20 overflow-hidden bg-[#F8F7F3] text-[#1A1A1A]"
      >
        <div className="relative z-10 max-w-6xl mx-auto w-full pt-28 pb-14 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[0.95] mb-5">
              {data.typeName}
            </h1>
            <p className="text-base opacity-80 font-light leading-[1.85] max-w-xl mb-6">
              {data.m1.persona}
            </p>
            <p className="text-base text-[#5E5E5E] font-light leading-[1.85]">
              {data.m1.slogan}
            </p>
          </div>
          <div className="relative hidden lg:block w-full max-w-xs aspect-[3/4] ml-auto">
            <Image
              src={`/images/character/${data.scoreRange}/${data.scoreRange}_female.png`}
              alt={`${data.typeName} 形象`}
              fill
              className="object-contain object-bottom"
              sizes="(max-width: 1280px) 45vw, 33vw"
              priority
            />
          </div>
        </div>
      </section>

      {/* Introduction + Skin Decode */}
      <section className="py-20 md:py-32 px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-3xl mx-auto">
          {data.m2.openingQuote && (
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-light text-[#1B3A5C] leading-snug mb-12 text-center">
              {data.m2.openingQuote}
            </blockquote>
          )}
          <div className="prose prose-stone max-w-none">
            {formatParagraphs(data.m2.portrait)}
          </div>
          {(data.m3.title?.trim() || data.m3.analysis?.trim()) && (
            <div className="mt-16 md:mt-20">
              {data.m3.title?.trim() && (
                <h2 className="text-2xl md:text-3xl font-light text-[#1A1A1A] tracking-tight mb-10">
                  {data.m3.title}
                </h2>
              )}
              {data.m3.analysis?.trim() && (
                <div className="text-[#4A4A4A] leading-[1.85] text-base">
                  {formatParagraphs(data.m3.analysis)}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Advantages */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-10">
            {data.m5.title || "优势高光"}
          </h2>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {data.m5.advantages.map((adv, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-8 shadow-sm border border-[#E8E2D9] hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1B3A5C] text-white text-sm font-medium">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-medium text-[#1A1A1A]">{adv.title}</h3>
                </div>
                <p className="text-[#5E5E5E] leading-[1.85] text-sm">{adv.content}</p>
              </div>
            ))}
          </div>
          {data.m5.quote && (
            <div className="text-center max-w-4xl mx-auto py-10 md:py-14 px-6">
              <blockquote className="text-xl md:text-2xl font-light leading-relaxed text-[#1A1A1A] tracking-wide md:whitespace-nowrap">
                <span className="text-2xl md:text-4xl font-bold text-[#F0EDE1]">「</span>
                {" "}
                {data.m5.quote}
                {" "}
                <span className="text-2xl md:text-4xl font-bold text-[#F0EDE1]">」</span>
              </blockquote>
            </div>
          )}
        </div>
      </section>

      {/* Daily Routine */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-[#F8F7F3]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-10">
            {data.m4.title || "我们建议的护肤日常"}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: "优雅日常", subtitle: "每日专属的精简守护", icon: Sun },
              { title: "居家仪式", subtitle: "享受 DIY 的美好时光", icon: Home },
              { title: "单品好物", subtitle: "随时随地按需使用", icon: ShoppingBag },
              { title: "专业水疗", subtitle: "沉静式悦己体验", icon: SoapDispenserDroplet },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <a
                  key={i}
                  href="https://nihplod.cn/guide"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block bg-white rounded-2xl p-8 shadow-sm border border-[#E8E2D9] hover:shadow-md hover:border-[#C9A86C]/50 transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-medium text-[#1A1A1A] mb-1 group-hover:text-[#1B3A5C] transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-[#8A8A8A] leading-[1.85]">{item.subtitle}</p>
                    </div>
                    <Icon className="w-11 h-11 text-[#C9A86C] stroke-[1.25] flex-shrink-0" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Blind Spots */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-10">
            {data.m6.title || "潜在盲区"}
          </h2>
          <div className="space-y-8">
            {data.m6.reminders.map((rem, i) => (
              <div key={i} className="flex gap-6">
                <span className="text-3xl md:text-4xl font-extralight text-[#C9A86C]/40 leading-none w-10 text-right">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-[#1A1A1A] mb-3">{rem.title}</h3>
                  <p className="text-sm text-[#5E5E5E] leading-[1.85]">{rem.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Skincare Formula */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-[#F8F7F3]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-4">
            {data.m7.title || `${data.typeName}的精准护肤公式`}
          </h2>
          {data.m7.formulaCore && (
            <p className="text-lg text-[#8A8A8A] font-light mb-10 leading-[1.85]">
              {data.m7.formulaCore}
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {data.m7.suggestions.map((sug, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-[#E8E2D9]">
                <div className="flex items-center gap-3 mb-4">
                  <Heart className="w-5 h-5 text-[#B76E79]" />
                  <h3 className="text-base font-medium text-[#1A1A1A]">{sug.title}</h3>
                </div>
                <p className="text-sm text-[#5E5E5E] leading-[1.85]">{sug.content}</p>
              </div>
            ))}
          </div>

          {data.m7.ingredientTable.length > 0 && (
            <div className="overflow-x-auto mb-12">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#D9D0C3]">
                    {ingredientHeaders.map((h) => (
                      <th key={h} className="text-left py-3 px-4 font-medium text-[#8A8A8A] uppercase tracking-wider text-xs">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.m7.ingredientTable.map((row, i) => (
                    <tr key={i} className="border-b border-[#E8E2D9] last:border-0 hover:bg-white/60">
                      {ingredientHeaders.map((h) => (
                        <td key={h} className="py-4 px-4 text-[#4A4A4A]">
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.m7.onlyOneSet && (
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div>
                <h3 className="text-2xl md:text-3xl font-light mb-5">最小必要集合</h3>
                <p className="text-base text-[#5E5E5E] leading-[1.85]">{data.m7.onlyOneSet}</p>
              </div>
              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-[#E8E2D9]">
                {/* 替换为风景 UI 图片 */}
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[#8A8A8A]">
                  风景 UI 图片占位
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-4">
            想知道你的真实肤质类型吗？
          </h2>
          <p className="text-base text-[#5E5E5E] font-light leading-[1.85] mb-10 max-w-xl mx-auto">
            回答几个简单问题，即可获得专属肌肤诊断与护肤建议。
          </p>
          <Link
            href="/questions"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-[#1B3A5C] text-white text-sm uppercase tracking-[0.15em] rounded-full hover:bg-[#1B3A5C]/90 transition-colors duration-300"
          >
            立即测试
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center border-t border-[rgba(61,68,48,0.08)]">
        <p className="flex items-start justify-center gap-2 text-[10px] sm:text-xs text-[#8A8A8A] leading-[1.8] max-w-2xl mx-auto mb-6">
          <Info className="w-3.5 h-3.5 text-[#C9A86C] flex-shrink-0 mt-0.5 stroke-[2]" />
          <span>
            该类型仅表示此综合评分下普遍情况，不代表您的素颜测肤结果。请完成测试，以获取您的专属素颜分析报告。
          </span>
        </p>
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
    </article>
  );
}
