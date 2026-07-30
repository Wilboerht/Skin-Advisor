"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
import type { SkinTypeData } from "@/lib/result-content";

const CURRENT_YEAR = new Date().getFullYear();

// WebGL 背景懒加载，避免 SSR 开销 & 手机端不必要初始化
const Threads = dynamic(() => import("@/components/ui/Threads"), { ssr: false });

interface ResultDetailPageProps {
  data: SkinTypeData;
}

export default function ResultDetailPage({ data }: ResultDetailPageProps) {
  const tableColumns = useMemo(() => {
    if (!data.m7?.ingredientTable?.length) return [];
    return Object.keys(data.m7.ingredientTable[0]);
  }, [data.m7?.ingredientTable]);

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-brand-charcoal">
      {/* 顶部导航 */}
      <WebsiteNavbar />

      <article>
      {/* Hero */}
      <section
        className="relative min-h-[380px] md:min-h-[560px] px-6 md:px-12 lg:px-20 overflow-hidden bg-[#F8F7F3] text-brand-charcoal"
      >
        <div className="relative z-10 max-w-5xl mx-auto w-full pt-24 md:pt-28 pb-10 md:pb-14 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center">
          <div className="max-w-2xl">
            <h1 className="text-2xl md:text-4xl lg:text-6xl font-serif font-light tracking-[0.02em] leading-[1.1] text-brand-charcoal mb-4 md:mb-5">
              {data.typeName}
            </h1>
            <p className="text-[13px] md:text-base text-brand-charcoal/75 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em] max-w-xl">
              {data.m1.persona}
            </p>
          </div>
          <div className="relative w-full max-w-[180px] mx-auto lg:max-w-[260px] lg:ml-auto lg:mr-0 aspect-[3/4]">
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
      <section className="relative overflow-hidden py-14 md:py-16 px-6 md:px-12 lg:px-20 bg-white">
        <Threads
          className="hidden md:block absolute top-[40%] left-0 right-0 -translate-y-1/2 h-[95%] z-0 pointer-events-none opacity-30"
          color={[0.92, 0.93, 0.94]}
          amplitude={0.8}
          distance={0}
          enableMouseInteraction={false}
        />
        <div className="relative z-10 max-w-5xl mx-auto">
          <h2 className="text-lg md:text-2xl font-serif font-light text-brand-charcoal tracking-[0.02em] mb-6 md:mb-8">
            {data.m5?.title || "优势高光"}
          </h2>
          <div className="grid grid-cols-1">
            {(data.m5?.advantages ?? []).map((adv, i) => (
              <div
                key={i}
                className={`group py-6 md:py-8 ${i < (data.m5?.advantages?.length ?? 0) - 1 ? 'border-b border-brand-charcoal/[0.06]' : ''}`}
              >
                <div className="flex items-baseline gap-4 md:gap-6 mb-3 md:mb-4">
                  <span className="text-2xl md:text-3xl font-serif font-light text-brand-charcoal/15 leading-none transition-colors duration-300 group-hover:text-brand-charcoal/30 select-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-lg md:text-xl font-serif font-light text-brand-charcoal tracking-[0.02em]">{adv.title}</h3>
                </div>
                <p className="pl-10 md:pl-[3.75rem] text-brand-charcoal/60 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em] text-[13px] md:text-sm">{adv.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Skincare Formula */}
      <section className="py-14 md:py-16 px-6 md:px-12 lg:px-20 bg-[#F8F7F3]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg md:text-2xl font-serif font-light text-brand-charcoal tracking-[0.02em] mb-4 md:mb-5">
            {data.m7?.title || `${data.typeName}的精准护肤公式`}
          </h2>
          {data.m7?.formulaCore && (
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-8 md:mb-10">
              {data.m7.formulaCore.split(/\s*[·・]\s*/).filter(Boolean).map((keyword, i) => (
                <span key={i} className="text-[11px] md:text-xs tracking-[0.12em] text-brand-charcoal/50 border border-brand-charcoal/12 rounded-full px-3 py-1 font-light">
                  {keyword}
                </span>
              ))}
            </div>
          )}

          {/* Suggestions — editorial 2-col */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 md:gap-x-12">
            {(data.m7?.suggestions ?? []).map((sug, i) => (
              <div
                key={i}
                className="group py-5 md:py-6 border-b border-brand-charcoal/[0.06] last:border-b-0 md:[&:nth-last-child(2)]:border-b-0"
              >
                <div className="flex items-baseline gap-3 md:gap-4 mb-2 md:mb-3">
                  <span className="text-xl md:text-2xl font-serif font-light text-brand-charcoal/15 leading-none transition-colors duration-300 group-hover:text-brand-charcoal/30 select-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em]">{sug.title}</h3>
                </div>
                <p className="pl-8 md:pl-10 text-brand-charcoal/60 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em] text-[13px] md:text-sm">{sug.content}</p>
              </div>
            ))}
          </div>

          {data.m7?.ingredientTable?.length > 0 && (
            <>
              {/* 桌面端：表格 */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-brand-charcoal/[0.08] bg-white mt-10 md:mt-12">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-brand-charcoal/[0.03]">
                      {tableColumns.map((h) => (
                        <th key={h} className="text-left py-3.5 px-5 font-light text-brand-charcoal/70 tracking-[0.08em] text-xs">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.m7.ingredientTable.map((row, i) => (
                      <tr key={i} className="border-t border-brand-charcoal/[0.06] hover:bg-brand-charcoal/[0.02] transition-colors duration-200">
                        {tableColumns.map((h) => (
                          <td key={h} className="py-4 px-5 text-brand-charcoal/75 font-light text-[13px]">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 手机端：卡片列表 */}
              <div className="md:hidden mt-8 space-y-5">
                {data.m7.ingredientTable.map((row, i) => (
                  <div key={i} className="border-l-2 border-brand-charcoal/20 pl-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-block px-2 py-0.5 text-[11px] tracking-[0.1em] text-brand-charcoal/60 bg-brand-charcoal/[0.04] rounded-full">
                        {row["护肤层级"]}
                      </span>
                    </div>
                    <p className="text-[13px] text-brand-charcoal/90 font-light mb-1">
                      {row["推荐产品"]}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-brand-charcoal/50 tracking-[0.06em]">
                      <span>{row["适用场景"]}</span>
                      <span className="text-brand-charcoal/20">·</span>
                      <span>{row["使用频率"]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Only One Set */}
          {data.m7?.onlyOneSet && (
            <div className="mt-10 md:mt-12 border-l-[3px] border-brand-charcoal/20 pl-5 md:pl-8 group transition-colors duration-300 hover:border-brand-charcoal/40">
              <span className="inline-block text-[11px] tracking-[0.15em] text-brand-charcoal/60 bg-brand-charcoal/[0.05] rounded-full px-3 py-1 mb-3">
                极简之选
              </span>
              <p className="text-[13px] md:text-sm text-brand-charcoal/90 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em]">
                {data.m7.onlyOneSet}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Daily Routine */}
      <section className="py-14 md:py-16 px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg md:text-2xl font-serif font-light text-brand-charcoal tracking-[0.02em] mb-6 md:mb-8">
            {data.m4?.title || "我们建议的护肤日常"}
          </h2>
          <div className="grid md:grid-cols-2 md:divide-x md:divide-brand-charcoal/[0.08]">
            {[
              { label: "晨", content: data.m4?.morning },
              { label: "夜", content: data.m4?.night },
            ].map((item, i) => {
              if (!item.content) return null;
              return (
                <div
                  key={i}
                  className={`relative ${i === 0 ? 'md:pr-10 lg:pr-14' : 'md:pl-10 lg:pl-14'} ${i === 0 ? 'mb-10 md:mb-0' : ''}`}
                >
                  {/* Watermark time marker */}
                  <span className="block text-5xl md:text-7xl font-serif font-light text-brand-charcoal/[0.06] leading-none mb-4 md:mb-6 select-none" aria-hidden="true">
                    {item.label}
                  </span>
                  <p className="text-[13px] md:text-sm text-brand-charcoal/60 font-light leading-[1.9] md:leading-[1.8] tracking-[0.06em] md:tracking-[0.12em] max-w-md">
                    {item.content}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 md:py-20 px-6 md:px-12 lg:px-20 bg-[#FAFAF7] border-t border-brand-charcoal/[0.06]">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <span aria-hidden="true" className="block w-10 h-px bg-brand-charcoal/20 mx-auto mb-6 md:mb-8" />
          <h2 className="text-xl md:text-3xl font-serif font-light text-brand-charcoal tracking-[0.04em] leading-relaxed mb-8 md:mb-10">
            每一种肌肤，都值得被认真对待
          </h2>
          <div className="flex justify-center">
            <Link
              href="/"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-3.5 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[13px] sm:text-[14px] tracking-[0.1em] font-light cursor-pointer transition-all duration-500 hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,38,62,0.12)] active:translate-y-0 active:shadow-none"
            >
              <span>前往测肤</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
            </Link>
          </div>
          <div className="mt-6">
            <Link
              href="/gift"
              className="group inline-flex items-center gap-1.5 text-[13px] text-brand-charcoal/50 tracking-[0.1em] font-light transition-colors duration-300 hover:text-brand-charcoal/80"
            >
              <span className="relative">
                参与「肌智派」活动，抽奖赢好礼
                <span className="absolute left-0 -bottom-0.5 w-0 h-px bg-brand-charcoal/40 transition-all duration-500 group-hover:w-full" />
              </span>
              <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-6 md:pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] px-6 text-center">
        <div className="flex flex-col items-center justify-center gap-2 text-[11px] font-light text-brand-charcoal/[0.48]">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 tracking-[0.1em] md:tracking-[0.12em]">
            <p suppressHydrationWarning>© {CURRENT_YEAR} NIHPLOD. All Rights Reserved.</p>
            <span className="text-brand-charcoal/20">·</span>
            <Link href="https://nihplod.cn/privacy" className="transition-colors duration-300 hover:text-brand-charcoal/70">
              隐私政策
            </Link>
            <span className="text-brand-charcoal/20">·</span>
            <Link href="https://nihplod.cn/terms" className="transition-colors duration-300 hover:text-brand-charcoal/70">
              服务条款
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 tracking-[0.12em]">
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="transition-colors duration-300 hover:text-brand-charcoal/70">
              沪ICP备2026014764号-1
            </a>
            <span aria-hidden="true" className="hidden sm:inline text-brand-charcoal/20">|</span>
            <a href="http://www.beian.gov.cn/portal/registerSystemInfo" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 transition-colors duration-300 hover:text-brand-charcoal/70">
              <Image src="/images/beian.webp" alt="" width={12} height={12} className="shrink-0 opacity-80" />
              <span>沪公网安备31010702010178号</span>
            </a>
          </div>
        </div>
      </footer>
      </article>
    </main>
  );
}
