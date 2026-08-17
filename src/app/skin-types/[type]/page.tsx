import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ResultDetailPage from "@/components/result/ResultDetailPage";
import { routeOrder, getSkinTypeByRoute } from "@/lib/result-content";
import { ArticleSchema, FAQPageSchema, BreadcrumbSchema } from "@/components/website/StructuredData";
import { withDefaultOgImage } from "@/lib/metadata";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

export async function generateStaticParams() {
  return routeOrder.map((route) => ({ type: route }));
}

interface PageProps {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type } = await params;
  const data = getSkinTypeByRoute(type);
  if (!data) {
    return { title: "页面未找到" };
  }

  const title = data.typeName;
  const ogTitle = `${data.typeName}肤质详解 | NIHPLOD肌肤类型`;
  const description = `${data.typeName}：${data.m1.persona}。了解${data.typeName}的护肤要点、产品推荐与日常护理方案。`;

  return withDefaultOgImage({
    title,
    description,
    keywords: [data.typeName, "肤质类型", "护肤方案", "NIHPLOD", "肌肤测试"],
    alternates: { canonical: `/skin-types/${type}` },
    openGraph: {
      title: ogTitle,
      description,
      type: "article",
      locale: "zh_CN",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  });
}

export const revalidate = 86400;

export default async function TypeResultPage({ params }: PageProps) {
  const { type } = await params;
  const data = getSkinTypeByRoute(type);
  if (!data) {
    notFound();
  }

  const faqs = [
    {
      question: `${data.typeName}肤质有什么特点？`,
      answer: data.m1.persona,
    },
    {
      question: `${data.typeName}应该如何护肤？`,
      answer: data.m4?.title || `针对${data.typeName}的护肤方案`,
    },
    {
      question: `${data.typeName}适合什么护肤品？`,
      answer: `NIHPLOD 会根据${data.typeName}的肤质特征，从产品库中推荐最适合的护肤品。`,
    },
  ];

  return (
    <>
      <ArticleSchema
        headline={`${data.typeName}肤质详解 — NIHPLOD 肌肤类型分析`}
        description={data.m1.persona}
        image={`${BASE_URL}/images/character/${data.ipKey}/${data.ipKey}_female.webp`}
        url={`${BASE_URL}/skin-types/${type}`}
      />
      <FAQPageSchema faqs={faqs} />
      <BreadcrumbSchema
        items={[
          { name: "首页", url: BASE_URL },
          { name: "肌肤类型", url: `${BASE_URL}/skin-types` },
          { name: data.typeName, url: `${BASE_URL}/skin-types/${type}` },
        ]}
      />
      <ResultDetailPage data={data} />
    </>
  );
}
