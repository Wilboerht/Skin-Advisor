import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Gift } from "lucide-react";
import { skinTypes, routeOrder } from "@/lib/result-content";
import { withDefaultOgImage } from "@/lib/metadata";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
import { GiftFloatCard } from "@/components/website/GiftFloatCard";
import { BreadcrumbSchema } from "@/components/website/StructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

export const metadata: Metadata = withDefaultOgImage({
  title: "肌智派",
  description:
    "探索 NIHPLOD 8 种肌肤形象类型（IP Types）——从敏敏派到守护派，每种肤质都有完整的护理方案与产品推荐。",
  keywords: ["肤质类型", "肌肤测试", "NIHPLOD", "敏感肌", "油性皮肤", "干性皮肤", "混合肌"],
  alternates: { canonical: "/skin-types" },
  openGraph: {
    title: "8 种肌肤形象类型详解 | NIHPLOD 肤质分类",
    description: "探索 NIHPLOD 8 种肌肤形象类型——从敏敏派到守护派。",
    type: "website",
    locale: "zh_CN",
  },
});

export const revalidate = 86400;

export default function ResultIndexPage() {
  const orderedTypes = routeOrder
    .map((route) => skinTypes.find((t) => t.route === route))
    .filter(Boolean);

  return (
    <main className="relative min-h-screen text-brand-charcoal bg-[#FDFBF7]">
      <BreadcrumbSchema
        items={[
          { name: "首页", url: BASE_URL },
          { name: "肌肤类型", url: `${BASE_URL}/skin-types` },
        ]}
      />
      {/* 顶部导航 */}
      <WebsiteNavbar />

      {/* Hero */}
      <section className="relative pt-24 md:pt-40 pb-14 md:pb-32 px-6 md:px-12 lg:px-20 overflow-hidden">

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1
            className="text-xl md:text-3xl font-serif font-light text-brand-charcoal leading-[1.1] tracking-[0.02em] mb-5 opacity-0 animate-fade-in-up"
            style={{ animationFillMode: "forwards" }}
          >
            了解不同肌肤类型与护理方案
          </h1>
          <Link
            href="/"
            className="w-full sm:w-auto group relative inline-flex items-center justify-center gap-3 px-8 py-4 border border-brand-charcoal/60 text-brand-charcoal bg-transparent text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer transition-all duration-500 hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,38,62,0.12)] focus-visible:outline-none focus-visible:border-brand-charcoal focus-visible:bg-brand-charcoal/[0.05] active:translate-y-0 active:shadow-none opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}
          >
            <span>了解我的肤质类型</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
          </Link>
          <Link
            href="/gift"
            className="flex items-center justify-center gap-1.5 mt-5 text-[13px] sm:text-[14px] text-brand-charcoal/75 tracking-[0.12em] font-light opacity-0 animate-fade-in-up hover:text-brand-charcoal focus-visible:outline-none focus-visible:text-brand-charcoal transition-colors duration-300"
            style={{ animationDelay: "0.3s", animationFillMode: "forwards" }}
          >
            参与「肌智派」活动，抽奖赢好礼
            <Gift className="w-3.5 h-3.5" />
          </Link>

        </div>
      </section>

      {/* 类型卡片 */}
      <section className="px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-x-5 md:gap-x-7 gap-y-6 md:gap-y-10">
          {orderedTypes.map((type) => {
            if (!type) return null;
            return (
              <Link
                key={type.route}
                href={`/skin-types/${type.route}`}
                className="group relative rounded-2xl border border-brand-charcoal/[0.08] bg-[#FAF9F6] p-4 md:p-9 transition-all duration-500 hover:shadow-[0_16px_32px_rgba(0,38,62,0.08)] hover:-translate-y-1"
              >
                <Image
                  src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
                  alt=""
                  width={180}
                  height={280}
                  className="absolute -right-2 -bottom-3 w-[110px] h-[184px] md:w-[152px] md:h-[264px] object-contain opacity-100 group-hover:scale-105 transition-transform duration-500 pointer-events-none select-none"
                />
                <div className="relative z-10 pr-20 md:pr-24">
                  <h2 className="text-lg md:text-2xl font-serif font-light tracking-[0.02em] text-brand-charcoal mb-1 md:mb-2 group-hover:text-brand-charcoal-light transition-colors duration-500">
                    {type.typeName}
                  </h2>
                  <p className="text-[13px] md:text-sm text-brand-charcoal/60 font-light tracking-[0.06em] md:tracking-[0.12em] mb-3 md:mb-5 line-clamp-1">
                    {type.m1.persona}
                  </p>
                  <div className="inline-flex items-center text-xs md:text-[13px] font-light tracking-[0.12em] text-brand-charcoal/60 group-hover:text-brand-charcoal-light transition-colors duration-300">
                    查看完整解读
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform duration-500 group-hover:translate-x-1.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 底部 CTA - 送好礼 */}
      <section className="py-14 md:py-20 px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/gift"
            className="group relative block p-5 md:p-12 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_85%)]"
          >
            {/* 右侧背景水印 */}
            <Image
              src="/images/watermark.png"
              alt=""
              width={200}
              height={200}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-130 h-auto object-contain opacity-15 pointer-events-none select-none"
              unoptimized
            />
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <Image
                src="/images/gift-badge.png"
                alt=""
                width={160}
                height={120}
                className="w-36 md:w-52 h-auto object-contain shrink-0"
                unoptimized
              />
              <div className="text-center md:text-left">
                <h3 className="text-lg md:text-2xl font-serif font-light text-brand-charcoal mb-1 md:mb-2 tracking-[0.02em]">
                  肌智派送好礼
                </h3>
                <p className="text-[13px] md:text-base text-brand-charcoal/75 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em] mb-3 md:mb-4">
                  完成您的专属肌肤诊断后，即可参与 NIHPLOD 限定抽奖——甄选护肤好礼，静候与您相遇。
                </p>
                <span className="inline-flex items-center gap-2 text-[13px] sm:text-[14px] font-light tracking-[0.12em] text-brand-charcoal group-hover:text-brand-charcoal-light transition-colors duration-300">
                  立即参与
                  <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="pt-6 md:pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] px-6 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-[11px] font-light text-brand-charcoal/[0.48]">
          <p className="tracking-[0.1em] md:tracking-[0.15em]">© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
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
      {/* 右下角悬浮活动卡片 */}
      <div className="hidden md:block">
        <GiftFloatCard />
      </div>
    </main>
  );
}
