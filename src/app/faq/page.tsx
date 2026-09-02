import type { Metadata } from "next";
import { withDefaultOgImage } from "@/lib/metadata";
import { SiteFooter } from "@/components/website/SiteFooter";
import { FAQPageSchema, BreadcrumbSchema } from "@/components/website/StructuredData";
import { faqs } from "@/lib/faq-data";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

export const metadata: Metadata = withDefaultOgImage({
  title: "常见问题 — AI 护肤分析 FAQ",
  description:
    "关于 NIHPLOD AI 护肤分析的常见问题解答：在线测肤准确吗？如何上传照片？数据安全吗？护肤品推荐怎么来的？",
  keywords: ["AI护肤FAQ", "测肤问题", "护肤常见问题", "NIHPLOD帮助"],
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "常见问题 — AI 护肤分析 FAQ | NIHPLOD",
    description: "关于 NIHPLOD AI 护肤分析的常见问题解答。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "常见问题 — AI 护肤分析 FAQ | NIHPLOD",
    description: "关于 NIHPLOD AI 护肤分析的常见问题解答。",
  },
});

export const revalidate = 86400;

export default function FAQPage() {
  return (
    <div className="relative min-h-screen text-[#1A1A1A] bg-[#FDFBF7] pb-dock">
      <FAQPageSchema faqs={faqs} />
      <BreadcrumbSchema
        items={[
          { name: "首页", url: BASE_URL },
          { name: "常见问题", url: `${BASE_URL}/faq` },
        ]}
      />

      {/* 顶部导航已移除，由根 layout 的 BottomDock 统一承担导航 */}

      {/* Hero */}
      <section className="relative pt-12 md:pt-20 pb-12 md:pb-20 px-6 md:px-12 lg:px-20">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] tracking-[0.25em] text-[#8B7355] uppercase mb-5">
            Frequently Asked Questions
          </p>
          <h1 className="text-2xl md:text-3xl font-serif text-[#1A1A1A] mb-5">
            AI 护肤分析 · 常见问题
          </h1>
          <p className="text-[15px] md:text-base text-[#5E5E5E] font-light max-w-xl mx-auto leading-relaxed">
            关于 NIHPLOD AI 护肤分析的使用方法、准确性、数据隐私等问题，在这里找到答案。
          </p>
        </div>
      </section>

      {/* FAQ 列表 */}
      <section className="pb-20 md:pb-36 px-6 md:px-12 lg:px-20">
        <div className="max-w-3xl mx-auto divide-y divide-[rgba(61,68,48,0.08)]">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group py-5 md:py-6 cursor-pointer"
              id={`faq-${i + 1}`}
            >
              <summary className="flex items-center justify-between gap-4 text-[15px] md:text-base font-medium text-[#1A1A1A] list-none marker:content-none hover:text-[#3D4430] transition-colors">
                <span>{faq.question}</span>
                <span className="shrink-0 text-[#8B7355] text-lg leading-none group-open:rotate-45 transition-transform duration-300">
                  +
                </span>
              </summary>
              <p className="mt-4 text-[14px] md:text-[15px] text-[#5E5E5E] font-light leading-relaxed">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* 页脚 */}
      <SiteFooter />
    </div>
  );
}
