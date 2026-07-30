"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Sun, Home, ShoppingBag, SoapDispenserDroplet, ArrowRight } from "lucide-react";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
import type { SkinTypeData } from "@/lib/result-content";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";
const CURRENT_YEAR = new Date().getFullYear();

// WebGL 背景懒加载，避免 SSR 开销 & 手机端不必要初始化
const Threads = dynamic(() => import("@/components/ui/Threads"), { ssr: false });

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
            <h1 className="text-2xl md:text-6xl lg:text-7xl font-serif font-light tracking-[0.02em] leading-[1.1] text-brand-charcoal mb-4 md:mb-5">
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
          className="hidden md:block absolute top-[40%] left-0 right-0 -translate-y-1/2 h-[95%] z-0 pointer-events-none"
          color={[0.941, 0.929, 0.882]}
          amplitude={1.5}
          distance={0}
          enableMouseInteraction={false}
        />
        <div className="relative z-10 max-w-5xl mx-auto">
          <h2 className="text-xl md:text-4xl font-serif font-light text-brand-charcoal tracking-[0.02em] mb-6 md:mb-8">
            {data.m5?.title || "优势高光"}
          </h2>
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {(data.m5?.advantages ?? []).map((adv, i) => (
              <div
                key={i}
                className="bg-transparent md:bg-white md:rounded-2xl p-0 md:p-8 md:shadow-sm md:border md:border-brand-charcoal/[0.08] md:hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-brand-charcoal text-white text-xs md:text-sm font-medium">
                    {i + 1}
                  </span>
                  <h3 className="text-base md:text-lg font-light text-brand-charcoal">{adv.title}</h3>
                </div>
                <p className="text-brand-charcoal/60 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em] text-[13px] md:text-sm">{adv.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Skincare Formula */}
      <section className="py-16 px-6 md:px-12 lg:px-20 bg-[#F8F7F3]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl md:text-4xl font-serif font-light text-brand-charcoal tracking-[0.02em] mb-3 md:mb-4">
            {data.m7?.title || `${data.typeName}的精准护肤公式`}
          </h2>
          {data.m7?.formulaCore && (
            <p className="text-sm md:text-lg text-brand-charcoal/60 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em] mb-6 md:mb-10">
              {data.m7.formulaCore}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {(data.m7?.suggestions ?? []).map((sug, i) => (
              <div key={i} className="flex flex-row md:flex-col items-start md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-brand-charcoal/[0.08] p-0 md:p-6 gap-3 md:gap-0">
                <span className="flex items-center justify-center w-5 h-5 md:w-8 md:h-8 rounded-full bg-transparent md:bg-brand-charcoal border border-brand-charcoal md:border-0 text-brand-charcoal md:text-white text-[10px] md:text-sm font-medium shrink-0 md:mb-4">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <h3 className="text-base font-light text-brand-charcoal mb-1 md:mb-3">{sug.title}</h3>
                  <p className="text-brand-charcoal/60 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em] text-[13px] md:text-sm">{sug.content}</p>
                </div>
              </div>
            ))}
          </div>

          {data.m7?.ingredientTable?.length > 0 && (
            <>
              {/* 桌面端：表格 — CSS hidden/md:block 避免 CLS */}
              <div className="hidden md:block overflow-x-auto mt-8 md:mt-12">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-brand-charcoal/20">
                    {tableColumns.map((h) => (
                      <th key={h} className="text-left py-3 px-4 font-medium text-brand-charcoal uppercase tracking-wider text-sm">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.m7.ingredientTable.map((row, i) => (
                    <tr key={i} className="border-b border-brand-charcoal/[0.08] last:border-0 hover:bg-white/60">
                      {tableColumns.map((h) => (
                        <td key={h} className="py-4 px-4 text-brand-charcoal/75 font-light">
                          {h === "推荐产品" ? (
                            <a
                              href={`${BASE_URL}/products`}
                              className="text-brand-charcoal hover:text-brand-charcoal-light transition-colors duration-300"
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

            {/* 手机端：卡片列表 */}
            <div className="md:hidden mt-8 space-y-6">
              {data.m7.ingredientTable.map((row, i) => (
                <div key={i} className="border-l-2 border-brand-charcoal pl-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-block px-2 py-0.5 text-[11px] tracking-[0.1em] text-brand-charcoal bg-brand-charcoal/[0.06] rounded-full">
                      {row["护肤层级"]}
                    </span>
                  </div>
                  <div className="mb-1">
                    <a
                      href={`${BASE_URL}/products`}
                      className="text-[13px] font-medium text-brand-charcoal hover:text-brand-charcoal-light transition-colors duration-300"
                    >
                      {row["推荐产品"]}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-brand-charcoal/60">
                    <span>{row["适用场景"]}</span>
                    <span className="text-brand-charcoal/20">·</span>
                    <span>{row["使用频率"]}</span>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}

        </div>
      </section>

      {/* Daily Routine */}
      <section className="py-16 px-6 md:px-12 lg:px-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl md:text-4xl font-serif font-light text-brand-charcoal tracking-[0.02em] mb-6 md:mb-8">
            {data.m4?.title || "我们建议的护肤日常"}
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
                  href={`${BASE_URL}/guide`}
                  className="group flex flex-col items-center text-center bg-[#FAF9F6] rounded-xl p-3 md:p-5 border border-brand-charcoal/[0.08] hover:shadow-sm hover:border-brand-charcoal/30 transition-all"
                >
                  <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-white border border-brand-charcoal/[0.08] mb-2 md:mb-3">
                    <Icon className="w-4 h-4 md:w-5 md:h-5 text-brand-charcoal/70 stroke-[1.25]" />
                  </div>
                  <h3 className="text-sm md:text-base font-medium text-brand-charcoal mb-0.5 md:mb-1 group-hover:text-brand-charcoal-light transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-brand-charcoal/60 leading-relaxed">{item.subtitle}</p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-14 md:py-16 px-6 md:px-12 lg:px-20 bg-white">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-serif font-light text-brand-charcoal tracking-[0.02em] mb-6">
            每一种肌肤，都值得被认真对待
          </h2>
          <Link
            href="/"
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-3.5 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[13px] sm:text-[14px] tracking-[0.1em] font-medium cursor-pointer transition-all duration-500 hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,38,62,0.12)] active:translate-y-0 active:shadow-none"
          >
            <span>前往测肤</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
          </Link>
          <Link
            href="/gift"
            className="flex items-center justify-center gap-2 mt-4 text-[13px] sm:text-[14px] text-brand-charcoal/60 tracking-[0.1em] font-medium hover:text-brand-charcoal transition-colors duration-300"
          >
            <Image
              src="/images/watermark.png"
              alt=""
              width={28}
              height={28}
              className="w-7 h-7 object-contain drop-shadow-[0_1px_1px_rgba(61,68,48,0.25)] animate-soft-blink"
              unoptimized
            />
            参与「肌智派」活动，抽奖赢好礼
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-6 md:pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] px-6 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-[11px] font-light text-brand-charcoal/[0.48]">
          <p suppressHydrationWarning className="tracking-[0.1em] md:tracking-[0.15em]">© {CURRENT_YEAR} NIHPLOD. All Rights Reserved.</p>
          <span className="hidden sm:inline text-brand-charcoal/20">·</span>
          <div className="hidden sm:flex items-center gap-3 tracking-[0.12em]">
            <Link href="https://nihplod.cn/privacy" className="transition-colors duration-300 hover:text-brand-charcoal/70">
              隐私政策
            </Link>
            <span className="text-brand-charcoal/20">·</span>
            <Link href="https://nihplod.cn/terms" className="transition-colors duration-300 hover:text-brand-charcoal/70">
              服务条款
            </Link>
          </div>
        </div>
      </footer>
      </article>
    </main>
  );
}
