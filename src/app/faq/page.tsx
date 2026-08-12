import type { Metadata } from "next";
import Link from "next/link";
import { withDefaultOgImage } from "@/lib/metadata";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
import { FAQPageSchema, BreadcrumbSchema } from "@/components/website/StructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

export const metadata: Metadata = withDefaultOgImage({
  title: "常见问题 — AI 护肤分析 FAQ",
  description:
    "关于 NIHPLOD AI 护肤分析的常见问题解答：AI 测肤准确吗？如何上传照片？数据安全吗？护肤品推荐怎么来的？",
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

const faqs: { question: string; answer: string }[] = [
  {
    question: "NIHPLOD AI 测肤准确吗？",
    answer:
      "NIHPLOD 使用基于深度学习的 68 点面部特征检测模型，结合大语言模型（LLM）综合分析。在标准光线下，AI 对肤质类型（油性/干性/混合/敏感等）的判断准确率与专业皮肤科医生相当。但请注意，它不能替代专业医疗诊断，如有严重皮肤问题请咨询医生。",
  },
  {
    question: "如何进行面部扫描？",
    answer:
      "进入首页点击「开始测试」，按照提示用手机或电脑摄像头拍摄正面自拍照片。建议在自然光下拍摄，不化浓妆，不戴眼镜，确保面部光线均匀。AI 会自动检测 68 个面部特征点进行分析。",
  },
  {
    question: "上传的照片会被保存吗？",
    answer:
      "不会。上传的照片仅用于实时的 AI 分析过程，分析完成后原始照片不会存储在服务器上。NIHPLOD 高度重视用户隐私，所有分析结果在 30 天后自动过期删除。详细信息请查看我们的隐私政策。",
  },
  {
    question: "护肤品推荐是如何生成的？",
    answer:
      "NIHPLOD 使用智能规则引擎 + AI 大模型双轨推荐系统。首先根据你的肤质类型（8 种 IP Types）、皮肤问题、季节和所在地区气候匹配产品库中的最佳产品；然后 AI 模型根据成分匹配和功效需求进行二次优化，最终生成个性化的产品推荐列表。",
  },
  {
    question: "NIHPLOD 支持匿名使用吗？",
    answer:
      "支持。你可以在不注册账号的情况下完成肤质测试并查看结果。匿名用户每天可享受免费测试。注册登录后可以保存历史报告、查看皮肤变化趋势、订阅护肤提醒等更多功能。",
  },
  {
    question: "8 种肌肤形象类型（IP Types）是什么意思？",
    answer:
      "NIHPLOD 独创的 IP Types 将复杂肤质抽象为 8 种形象类型：敏敏派（敏感型）、极简派（健康型）、社会派（暗沉型）、冻龄派（熟龄型）、沙漠派（缺水型）、油条派（油性型）、混合派（混合型）、守护派（问题型）。每种类型对应特定的护肤策略和产品推荐体系。你可以在肌肤类型页面查看每种类型的详细介绍。",
  },
  {
    question: "AI 护肤报告包含哪些内容？",
    answer:
      "完整报告包含：肤质类型诊断（8 种 IP Types 之一）、肤质评分（0-100 分）、面部各区域分析（T 区、U 区等）、护肤建议（早晚护理流程）、核心成分推荐、个性化产品推荐、以及适合你肤质的护肤技巧。你可以将报告分享到微信、小红书等社交平台。",
  },
  {
    question: "测试次数有限制吗？",
    answer:
      "注册用户每天可享受免费测试，会员享有更多次数。我们建议在皮肤状态发生明显变化时（如换季、更换护肤品后）重新测试，以获得最新的肤质分析结果。",
  },
  {
    question: "NIHPLOD 支持哪些平台？",
    answer:
      "NIHPLOD 是 Web 应用，支持所有主流浏览器（Chrome、Safari、Edge、Firefox）。在手机端浏览器中打开 nihplod.cn 即可使用完整功能。我们也在开发微信小程序版本，敬请期待。",
  },
  {
    question: "如何使用微信顾问服务？",
    answer:
      "访问顾问服务页面，使用微信扫描页面上的二维码，即可添加 NIHPLOD 护肤顾问微信。顾问会为你提供一对一专业护肤咨询，根据你的肤质报告给出更详细的建议和产品指导。",
  },
];

export const revalidate = 86400;

export default function FAQPage() {
  return (
    <main className="relative min-h-screen text-[#1A1A1A] bg-[#FDFBF7]">
      <FAQPageSchema faqs={faqs} />
      <BreadcrumbSchema
        items={[
          { name: "首页", url: BASE_URL },
          { name: "常见问题", url: `${BASE_URL}/faq` },
        ]}
      />

      <WebsiteNavbar />

      {/* Hero */}
      <section className="relative pt-24 md:pt-40 pb-12 md:pb-20 px-6 md:px-12 lg:px-20">
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

        {/* 底部 CTA */}
        <div className="max-w-3xl mx-auto mt-16 text-center">
          <p className="text-[13px] text-[#5E5E5E]/60 mb-5 font-light">
            还有其他问题？
          </p>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 px-8 py-3 border border-[#1B3A5C] text-[#1B3A5C] rounded-lg text-[13px] tracking-[0.1em] font-medium hover:bg-[#1B3A5C] hover:text-white transition-all duration-500"
          >
            联系护肤顾问
          </Link>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="pb-[calc(1rem+env(safe-area-inset-bottom,16px))] md:pb-[calc(2rem+env(safe-area-inset-bottom,16px))] px-6 text-center shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-4 text-[10px] md:text-xs tracking-widest text-[#5E5E5E]/60">
          <p>© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
          <span className="hidden sm:inline text-[#5E5E5E]/30">·</span>
          <div className="hidden sm:flex items-center gap-4">
            <Link href="https://nihplod.cn/privacy" className="hover:text-[#3D4430] transition-colors duration-300">
                隐私政策
            </Link>
            <span className="text-[#5E5E5E]/30">·</span>
            <Link href="https://nihplod.cn/terms" className="hover:text-[#3D4430] transition-colors duration-300">
                服务条款
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
