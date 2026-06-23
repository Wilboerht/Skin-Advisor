import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ResultDetailPage from "@/components/result/ResultDetailPage";
import { skinTypes, routeOrder, getSkinTypeByRoute } from "@/lib/result-content";

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
    return {
      title: "页面未找到 | NIHPLOD",
    };
  }
  return {
    title: `${data.typeName} · ${data.scoreRange}分 · NIHPLOD肌肤测试`,
    description: data.m1.persona,
    openGraph: {
      title: `${data.typeName} · NIHPLOD肌肤测试`,
      description: data.m1.persona,
      type: "article",
    },
  };
}

export default async function TypeResultPage({ params }: PageProps) {
  const { type } = await params;
  const data = getSkinTypeByRoute(type);
  if (!data) {
    notFound();
  }
  return <ResultDetailPage data={data} />;
}
