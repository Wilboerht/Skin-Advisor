"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, Shield, Sun, Moon, Heart } from "lucide-react";
import RadarChart from "./RadarChart";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
import type { SkinTypeData } from "@/lib/result-content";
interface ResultDetailPageProps {
  data: SkinTypeData;
}

const typeThemes: Record<string, { from: string; to: string; accent: string; stroke: string; heroText: string }> = {
  jiejinkuangmo: { from: "#1B3A5C", to: "#F5F1EB", accent: "#B76E79", stroke: "#B76E79", heroText: "#FFFFFF" },
  kangkuadaren: { from: "#0A1628", to: "#E8E4E0", accent: "#C9A86C", stroke: "#1B3A5C", heroText: "#FFFFFF" },
  tangpingwanjia: { from: "#7EB5D6", to: "#FAF8F5", accent: "#E8DCC4", stroke: "#7EB5D6", heroText: "#1A1A1A" },
  rouguangdaren: { from: "#F0EDE6", to: "#D4AF7A", accent: "#D4A5A5", stroke: "#2E5A6B", heroText: "#1A1A1A" },
  wenfuwanjia: { from: "#7A8B99", to: "#F5F1EB", accent: "#C9B896", stroke: "#1E3A4C", heroText: "#FFFFFF" },
  shengtukuangmo: { from: "#1B4965", to: "#5FA8D3", accent: "#D4A574", stroke: "#1B4965", heroText: "#FFFFFF" },
  shirundaren: { from: "#C9A86C", to: "#1B3A5C", accent: "#D4AF7A", stroke: "#C9A86C", heroText: "#FFFFFF" },
  donglingwanjia: { from: "#0A1628", to: "#E8D5D0", accent: "#C9A86C", stroke: "#1B3A5C", heroText: "#FFFFFF" },
  tianfukuangmo: { from: "#B8C4CE", to: "#F5F0E8", accent: "#C9A86C", stroke: "#B8C4CE", heroText: "#1A1A1A" },
  yulingzhuzai: { from: "#0A1628", to: "#C9A96E", accent: "#C9A96E", stroke: "#0A1628", heroText: "#FFFFFF" },
};

function formatParagraphs(text: string): React.ReactElement {
  const paragraphs = text.split("\n\n").filter((p) => p.trim());
  return (
    <>
      {paragraphs.map((p, i) => {
        const isSignature = p.trimStart().startsWith("——");
        return (
          <p
            key={i}
            className={`mb-5 last:mb-0 text-[#4A4A4A] leading-[1.85] text-[15px] md:text-base ${
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
  const theme = typeThemes[data.route] || typeThemes.jiejinkuangmo;

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
            <p className="text-base md:text-lg opacity-80 font-light leading-relaxed max-w-xl mb-6">
              {data.m1.persona}
            </p>
            <p className="text-[15px] md:text-base text-[#5E5E5E] font-light tracking-wide leading-relaxed">
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
                <h2 className="text-2xl md:text-3xl font-light text-[#1A1A1A] tracking-tight mb-6">
                  {data.m3.title}
                </h2>
              )}
              {data.m3.analysis?.trim() && (
                <div className="text-[#4A4A4A] leading-[1.85] text-[15px] md:text-base">
                  {formatParagraphs(data.m3.analysis)}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Daily Routine */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-[#F8F7F3]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-10">
            {data.m4.title || "护肤日常"}
          </h2>
          <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-4 space-y-6">
              <div className="p-6 rounded-xl bg-[#F5F2ED] border border-[#E8E2D9]">
                <Sun className="w-6 h-6 text-[#C9A86C] mb-3" />
                <p className="text-sm font-medium text-[#1A1A1A]">晨间仪式</p>
                <p className="text-xs text-[#8A8A8A] mt-1">温和清洁 · 精华滋养 · 防晒锁护</p>
              </div>
              <div className="p-6 rounded-xl bg-[#F5F2ED] border border-[#E8E2D9]">
                <Moon className="w-6 h-6 text-[#C9A86C] mb-3" />
                <p className="text-sm font-medium text-[#1A1A1A]">夜间修护</p>
                <p className="text-xs text-[#8A8A8A] mt-1">深层精华 · 脂质体面膜 · 面霜封存</p>
              </div>
            </div>
            <div className="md:col-span-8">
              {formatParagraphs(data.m4.scene)}
            </div>
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-[#F8F7F3]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-12">
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
                <p className="text-[#5E5E5E] leading-relaxed text-sm">{adv.content}</p>
              </div>
            ))}
          </div>
          {data.m5.quote && (
            <div className="text-center max-w-2xl mx-auto p-8 rounded-2xl bg-[#1B3A5C] text-white">
              <Sparkles className="w-6 h-6 mx-auto mb-4 opacity-70" />
              <blockquote className="text-xl md:text-2xl font-light leading-relaxed">
                {data.m5.quote}
              </blockquote>
            </div>
          )}
        </div>
      </section>

      {/* Blind Spots */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-10">
            {data.m6.title || "潜在盲区"}
          </h2>
          <div className="space-y-6">
            {data.m6.reminders.map((rem, i) => (
              <div key={i} className="flex gap-5 p-6 rounded-xl bg-[#FDFCFA] border border-[#E8E2D9]">
                <Shield className="w-5 h-5 text-[#B76E79] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-medium text-[#1A1A1A] mb-2">{rem.title}</h3>
                  <p className="text-sm text-[#5E5E5E] leading-relaxed">{rem.content}</p>
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
            <p className="text-lg text-[#8A8A8A] font-light mb-10 tracking-wide">
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
                <p className="text-sm text-[#5E5E5E] leading-relaxed">{sug.content}</p>
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
            <div className="bg-[#1B3A5C] text-white rounded-2xl p-8 md:p-10">
              <p className="text-xs uppercase tracking-[0.25em] text-white/60 mb-3">If Only One Set</p>
              <h3 className="text-xl md:text-2xl font-light mb-4">如果只能选一套</h3>
              <p className="text-white/90 leading-relaxed">{data.m7.onlyOneSet}</p>
            </div>
          )}
        </div>
      </section>

      {/* Radar Chart */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs uppercase tracking-[0.25em] text-[#8A8A8A] mb-3">Radar</p>
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-4">
            肤质雷达图
          </h2>
          <p className="text-[#8A8A8A] mb-10 max-w-xl">
            五维肌肤画像：水润度、细腻度、光泽度、紧致度、稳定度。
          </p>
          <div className="bg-[#FDFCFA] rounded-2xl p-6 md:p-10 border border-[#E8E2D9]">
            <RadarChart data={data.m8.radar} fillColor={theme.from} strokeColor={theme.stroke} />
            {data.m8.interpretation && (
              <div className="mt-8 text-center max-w-2xl mx-auto">
                <blockquote className="text-lg md:text-xl font-light text-[#1B3A5C]">
                  {data.m8.interpretation}
                </blockquote>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Persona */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-[#F8F7F3]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-10">
            {data.m9.title || "同类画像"}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: "生活方式", content: data.m9.lifestyle },
              { title: "审美偏好", content: data.m9.aesthetic },
              { title: "精神气质", content: data.m9.spirit },
              { title: "可能出现的场合", content: data.m9.occasions },
            ]
              .filter((item) => item.content)
              .map((item, i) => (
                <div
                  key={i}
                  className={`bg-white rounded-2xl p-8 shadow-sm border border-[#E8E2D9] ${
                    item.title === "可能出现的场合" ? "md:col-span-2" : ""
                  }`}
                >
                  <h3 className="text-sm uppercase tracking-wider text-[#8A8A8A] mb-4">{item.title}</h3>
                  <div className="text-[#4A4A4A] leading-relaxed text-sm">
                    {formatParagraphs(item.content)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-[#8A8A8A] mb-3">Start Your Journey</p>
          <h2 className="text-3xl md:text-4xl font-light text-[#1A1A1A] tracking-tight mb-4">
            想知道你的真实肤质类型吗？
          </h2>
          <p className="text-[#5E5E5E] font-light leading-relaxed mb-10 max-w-xl mx-auto">
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
