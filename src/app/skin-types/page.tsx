import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import { skinTypes, routeOrder } from "@/lib/result-content";
import { withDefaultOgImage } from "@/lib/metadata";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
import { GiftFloatCard } from "@/components/website/GiftFloatCard";
import { BreadcrumbSchema } from "@/components/website/StructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

export const metadata: Metadata = withDefaultOgImage({
  title: "8 种肌肤形象类型详解 | NIHPLOD 肤质分类",
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

export default function ResultIndexPage() {
  const orderedTypes = routeOrder
    .map((route) => skinTypes.find((t) => t.route === route))
    .filter(Boolean);

  return (
    <main className="relative min-h-screen text-[#1A1A1A] bg-[#F8F7F3]">
      <BreadcrumbSchema
        items={[
          { name: "首页", url: BASE_URL },
          { name: "肌肤类型", url: `${BASE_URL}/skin-types` },
        ]}
      />
      {/* 顶部导航 */}
      <WebsiteNavbar />

      {/* Hero */}
      <section className="relative pt-24 md:pt-40 pb-16 md:pb-32 px-6 md:px-12 lg:px-20 overflow-hidden">

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <h1
            className="text-2xl md:text-3xl font-serif text-[#1A1A1A] mb-5 opacity-0 animate-fade-in-up"
            style={{ animationFillMode: "forwards" }}
          >
            发现你的肌肤形象类型
          </h1>
          <p
            className="text-[15px] md:text-base text-[#5E5E5E] font-light max-w-xl mx-auto leading-relaxed mb-[30px] opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}
          >
            每一种肌肤，都有自己的性格。从素颜状态出发，读懂肌肤真正需要什么。
          </p>
          <Link
            href="/"
            className="group relative inline-flex items-center justify-center gap-3 px-10 py-3.5 border border-[#1B3A5C] text-[#1B3A5C] bg-transparent rounded-lg text-[13px] sm:text-[14px] tracking-[0.15em] font-medium cursor-pointer transition-all duration-500 hover:bg-[#1B3A5C] hover:text-white opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}
          >
            <span>前往测肤</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1.5" />
          </Link>

        </div>
      </section>

      {/* 类型卡片 */}
      <section className="px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-x-5 md:gap-x-7 gap-y-6 md:gap-y-10">
          {orderedTypes.map((type, i) => {
            if (!type) return null;
            return (
              <Link
                key={type.route}
                href={`/skin-types/${type.route}`}
                className="group relative rounded-2xl border border-[rgba(61,68,48,0.08)] bg-[#FAF9F6] p-5 md:p-9 transition-all duration-500 hover:shadow-[0_16px_32px_rgba(61,68,48,0.08)] hover:-translate-y-1"
              >
                <Image
                  src={`/images/character/${type.ipKey}/${type.ipKey}_female.png`}
                  alt=""
                  width={180}
                  height={280}
                  className="absolute -right-3 -bottom-4 w-[136px] h-[228px] md:w-[152px] md:h-[264px] object-contain opacity-100 group-hover:scale-105 transition-transform duration-500 pointer-events-none select-none"
                />
                <div className="relative z-10 pr-20 md:pr-20">
                  <h2 className="text-xl md:text-2xl font-serif tracking-wide text-[#1A1A1A] mb-2 group-hover:text-[#3D4430] transition-colors duration-500">
                    {type.typeName}
                  </h2>
                  <p className="text-sm text-[#5E5E5E]/70 leading-relaxed mb-5 line-clamp-1 font-light">
                    {type.m1.persona}
                  </p>
                  <div className="inline-flex items-center text-xs font-medium tracking-[0.15em] text-[#3D4430] group-hover:text-[#3D4430]/80 transition-colors duration-300">
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
      <section className="pt-20 pb-16 md:pb-24 px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/gift"
            className="group relative block p-8 md:p-12 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_85%)]"
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
                className="w-48 h-auto object-contain shrink-0"
                unoptimized
              />
              <div className="text-center md:text-left">
                <h3 className="text-xl md:text-2xl font-serif text-[#1A1A1A] mb-2 tracking-wide">
                  肌智派送好礼
                </h3>
                <p className="text-[15px] md:text-base text-[#5E5E5E] font-light leading-relaxed mb-4">
                  完成您的专属肌肤诊断后，即可参与 NIHPLOD 限定抽奖——甄选护肤好礼，静候与您相遇。
                </p>
                <span className="inline-flex items-center gap-2 text-sm font-medium tracking-[0.15em] text-[#A0784C] group-hover:text-[#8B6840] transition-colors duration-300">
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
      {/* 右下角悬浮活动卡片 */}
      <GiftFloatCard />
    </main>
  );
}
