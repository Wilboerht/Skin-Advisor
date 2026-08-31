import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Gift } from "lucide-react";
import { skinTypes, routeOrder } from "@/lib/result-content";
import { withDefaultOgImage } from "@/lib/metadata";
import { KineticBackground } from "@/components/website/KineticBackground";
import { HidePageScrollbar } from "@/components/website/HidePageScrollbar";
import { SkinTypesClient } from "@/components/website/SkinTypesClient";
import { GiftLink } from "@/components/website/GiftLink";
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
    <div className="relative min-h-dvh text-brand-charcoal pb-dock">
      {/* Kinetic 背景：与首页一致的米白底 + 水印 */}
      <KineticBackground />
      {/* 隐藏页面滚动条（保留滚动） */}
      <HidePageScrollbar />
      <BreadcrumbSchema
        items={[
          { name: "首页", url: BASE_URL },
          { name: "肌肤类型", url: `${BASE_URL}/skin-types` },
        ]}
      />
      {/* 顶部导航已移除，由根 layout 的 BottomDock 统一承担导航 */}

      {/* Hero */}
      <section className="relative pt-12 md:pt-20 pb-14 md:pb-32 px-6 md:px-12 lg:px-20 overflow-hidden">

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
          <GiftLink
            className="flex items-center justify-center gap-1.5 mt-5 text-[13px] sm:text-[14px] text-brand-charcoal/75 tracking-[0.12em] font-light opacity-0 animate-fade-in-up hover:text-brand-charcoal focus-visible:outline-none focus-visible:text-brand-charcoal transition-colors duration-300 mx-auto cursor-pointer"
            style={{ animationDelay: "0.3s", animationFillMode: "forwards" }}
          >
            参与「肌智派」活动，抽奖赢好礼
            <Gift className="w-3.5 h-3.5" />
          </GiftLink>

        </div>
      </section>

      {/* 类型卡片（点击打开详情弹窗） */}
      <section className="relative z-10 px-6 md:px-12 lg:px-20">
        <SkinTypesClient types={orderedTypes.filter((t): t is NonNullable<typeof t> => Boolean(t))} />
      </section>

      {/* 底部 CTA - 送好礼 */}
      <section className="py-14 md:py-20 px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <GiftLink className="group relative block w-full p-5 md:p-12 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_85%)] cursor-pointer text-left">
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
          </GiftLink>
        </div>
      </section>
    </div>
  );
}
