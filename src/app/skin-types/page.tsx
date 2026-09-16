import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { skinTypes, routeOrder } from "@/lib/result-content";
import { withDefaultOgImage } from "@/lib/metadata";
import { KineticBackground } from "@/components/website/KineticBackground";
import { HidePageScrollbar } from "@/components/website/HidePageScrollbar";
import { SkinTypesClient } from "@/components/website/SkinTypesClient";
import { SkinTypesMobileList } from "@/components/website/SkinTypesMobileList";
import { BreadcrumbSchema, SkinTypesItemListSchema } from "@/components/website/StructuredData";

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

// 页面不读 searchParams（?type= 深链接由客户端组件挂载后自行解析），
// 保证 /skin-types 以静态内容产出并走 ISR，而不是每次请求服务端渲染
export default function ResultIndexPage() {
  const orderedTypes = routeOrder
    .map((route) => skinTypes.find((t) => t.route === route))
    .filter(Boolean);

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
      {/* 8 派系 ItemList：名称 + 简介 + 深链接，辅助搜索结果展示 */}
      <SkinTypesItemListSchema
        items={orderedTypes
          .filter((t): t is NonNullable<typeof t> => Boolean(t))
          .map((t) => ({
            name: t.typeName,
            description: t.m1.persona,
            url: `${BASE_URL}/skin-types?type=${t.route}`,
          }))}
      />
      {/* 顶部导航已移除，由根 layout 的 BottomDock 统一承担导航 */}

      {/* Hero（紧凑版：标题 + 副标题 + CTA，为轮播让出舞台空间） */}
      <section className="relative pt-8 md:pt-12 pb-4 md:pb-6 px-6 md:px-12 lg:px-20 overflow-hidden shrink-0">

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* 印章徽标（标题上方居中，与首页统一规格：h-10 md:h-12 保证可读性） */}
          <div
            className="mb-4 md:mb-5 inline-flex items-center opacity-0 animate-fade-in-up"
            style={{ animationFillMode: "forwards" }}
          >
            <Image
              src="/images/jzp-eyebrow.png"
              alt="肌智派"
              width={256}
              height={156}
              sizes="(min-width: 768px) 79px, 66px"
              className="h-10 md:h-12 w-auto opacity-90 mix-blend-multiply"
              priority
            />
          </div>
          <h1
            className="text-xl md:text-2xl font-serif font-light text-brand-charcoal tracking-[0.02em] mb-4 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.06s", animationFillMode: "forwards" }}
          >
            肌智派<sup className="text-[0.55em] align-super font-sans">™</sup>形象与护理方案
          </h1>
          <p
            className="text-[13px] md:text-sm text-brand-charcoal/50 font-light tracking-[0.06em] mb-5 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.12s", animationFillMode: "forwards" }}
          >
            找到与你匹配的肌肤形象，获取专属护理方案
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
            {/* 主 CTA：空心描边胶囊（#00263E）；移动端全宽更易点按 */}
            <Link
              href="/?start=1"
              className="group inline-flex items-center justify-center gap-2 px-6 h-11 w-full sm:w-auto rounded-full border border-[#00263E]/40 bg-transparent text-[#00263E] text-sm font-medium transition-colors duration-200 hover:border-[#00263E] hover:bg-[#00263E]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00263E]/30 focus-visible:ring-offset-2 opacity-0 animate-fade-in-up"
              style={{ animationDelay: "0.18s", animationFillMode: "forwards" }}
            >
              <span>测一测，了解我的肤质类型</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </div>
        </div>
      </section>

      {/* 旋转木马：标题与 Dock 之间的剩余空间垂直居中，区域宽度移动端全宽/桌面 90% */}
      <section className="relative z-10 flex-1 flex items-center justify-center px-6 md:px-12 lg:px-20 pb-6 md:pb-8">
        <div className="w-full md:w-[90%]">
          {/* 移动端：纵向列表（替代轮播，全宽可读）；桌面端：轮播 */}
          <div className="md:hidden">
            <SkinTypesMobileList
              types={orderedTypes.filter((t): t is NonNullable<typeof t> => Boolean(t))}
            />
          </div>
          <div className="hidden md:block">
            <SkinTypesClient
              types={orderedTypes.filter((t): t is NonNullable<typeof t> => Boolean(t))}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
