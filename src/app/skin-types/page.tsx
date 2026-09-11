import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gift, ScanFace } from "lucide-react";
import { skinTypes, routeOrder, type SkinTypeData } from "@/lib/result-content";
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

export default async function ResultIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const orderedTypes = routeOrder
    .map((route) => skinTypes.find((t) => t.route === route))
    .filter(Boolean);
  // ?type=<route> 深链接：服务端解析为初始选中派系（详情弹窗自动打开）
  const initialType = (orderedTypes.find((t) => t && t.route === type) ?? null) as SkinTypeData | null;

  return (
    <div className="relative min-h-dvh text-brand-charcoal pb-dock flex flex-col overflow-x-hidden">
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

      {/* Hero（紧凑版：标题 + 副标题 + 双 CTA，为轮播让出舞台空间） */}
      <section className="relative pt-10 md:pt-12 pb-4 md:pb-6 px-6 md:px-12 lg:px-20 overflow-hidden shrink-0">

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1
            className="text-2xl md:text-3xl font-serif font-light text-brand-charcoal leading-[1.25] tracking-[0.02em] mb-3 opacity-0 animate-fade-in-up"
            style={{ animationFillMode: "forwards" }}
          >
            8 种肌肤类型与护理方案
          </h1>
          <p
            className="text-[13px] md:text-sm text-brand-charcoal/50 font-light tracking-[0.06em] mb-6 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.08s", animationFillMode: "forwards" }}
          >
            找到与你匹配的肌肤形象，获取专属护理方案
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
            {/* 主 CTA：与首页一致的品牌色实心胶囊，直达测肤流程（?start=1 由首页自动拉起完整流程） */}
            <Link
              href="/?start=1"
              className="group inline-flex items-center justify-center gap-2 px-7 md:px-8 h-11 rounded-full bg-[var(--color-brand-cocoa)] text-[#FDFBF7] text-[13px] md:text-[14px] tracking-[0.12em] font-light transition-all duration-300 hover:bg-[#4a3a2c] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(61,47,37,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/40 active:translate-y-0 active:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 opacity-0 animate-fade-in-up"
              style={{ animationDelay: "0.15s", animationFillMode: "forwards" }}
            >
              <ScanFace className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>了解我的肤质类型</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" />
            </Link>
            {/* 次 CTA：描边胶囊，与主按钮同高度形成并列层级 */}
            <GiftLink
              className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-full border border-brand-espresso/[0.15] text-[13px] md:text-[14px] text-brand-charcoal/70 tracking-[0.08em] font-light opacity-0 animate-fade-in-up hover:border-brand-espresso/40 hover:text-brand-charcoal transition-colors duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/40"
              style={{ animationDelay: "0.25s", animationFillMode: "forwards" }}
            >
              参与「肌智派」活动，抽奖赢好礼
              <Gift className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            </GiftLink>
          </div>
        </div>
      </section>

      {/* 旋转木马：标题与 Dock 之间的剩余空间垂直居中，区域宽度占页面 80% */}
      <section className="relative z-10 flex-1 flex items-center justify-center px-6 md:px-12 lg:px-20 pb-8">
        <div className="w-full md:w-[90%]">
          <SkinTypesClient
            types={orderedTypes.filter((t): t is NonNullable<typeof t> => Boolean(t))}
            initialType={initialType}
          />
        </div>
      </section>
    </div>
  );
}
