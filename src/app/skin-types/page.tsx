import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Gift } from "lucide-react";
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

      {/* Hero（紧凑版：为 PC 一屏"选英雄"舞台让出高度） */}
      <section className="relative pt-10 md:pt-12 pb-8 md:pb-10 px-6 md:px-12 lg:px-20 overflow-hidden">

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1
            className="text-xl md:text-2xl font-serif font-light text-brand-charcoal leading-[1.2] tracking-[0.02em] mb-5 opacity-0 animate-fade-in-up"
            style={{ animationFillMode: "forwards" }}
          >
            8 种肌智派，你是哪一派？
          </h1>
          {/* 8 派小圆头像群像：Hero 视觉焦点，点按跳转对应卡片弹窗 */}
          <div
            className="flex items-center justify-center gap-2.5 md:gap-3 mb-5 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.05s", animationFillMode: "forwards" }}
          >
            {orderedTypes.slice(0, 8).map((t) =>
              t ? (
                <a
                  key={t.route}
                  href={`/skin-types?type=${t.route}`}
                  aria-label={t.typeName}
                  title={t.typeName}
                  className="relative w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden border border-brand-charcoal/[0.1] bg-white/60 transition-transform duration-300 hover:scale-110 hover:border-brand-charcoal/30"
                >
                  <Image
                    src={`/images/character/${t.ipKey}/${t.ipKey}_female.webp`}
                    alt=""
                    fill
                    className="object-cover object-top scale-110"
                  />
                </a>
              ) : null
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/"
              className="group inline-flex items-center justify-center gap-3 px-8 py-3.5 border border-brand-espresso/30 text-brand-charcoal bg-transparent text-[13px] sm:text-[14px] tracking-[0.12em] font-light cursor-pointer transition-all duration-500 hover:bg-brand-charcoal/[0.07] hover:border-brand-charcoal hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(61,47,37,0.12)] focus-visible:outline-none focus-visible:border-brand-charcoal focus-visible:bg-brand-charcoal/[0.05] active:translate-y-0 active:shadow-none opacity-0 animate-fade-in-up"
              style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}
            >
              <span>了解我的肤质类型</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
            </Link>
            <GiftLink
              className="flex items-center justify-center gap-1.5 text-[13px] sm:text-[14px] text-brand-charcoal/75 tracking-[0.12em] font-light opacity-0 animate-fade-in-up hover:text-brand-charcoal focus-visible:outline-none focus-visible:text-brand-charcoal transition-colors duration-300 cursor-pointer"
              style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}
            >
              参与「肌智派」活动，抽奖赢好礼
              <Gift className="w-3.5 h-3.5" />
            </GiftLink>
          </div>
        </div>
      </section>

      {/* 类型卡片（点击打开详情弹窗） */}
      <section className="relative z-10 px-6 md:px-12 lg:px-20 pb-12">
        <SkinTypesClient
          types={orderedTypes.filter((t): t is NonNullable<typeof t> => Boolean(t))}
          initialType={initialType}
        />
        {/* 视觉收尾：画廊下方小字提示 */}
        <p className="mt-6 text-center text-[12px] text-brand-charcoal/40 font-light tracking-[0.08em]">
          点击任意派系，查看完整解读
        </p>
      </section>
    </div>
  );
}
