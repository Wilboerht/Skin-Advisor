import type { Metadata } from "next";
import HomeClient from "@/components/website/HomeClient";
import { withDefaultOgImage } from "@/lib/metadata";

export const revalidate = 3600;

export const metadata: Metadata = withDefaultOgImage({
  title: "NIHPLOD | 肌智派素颜测肤",
  description:
    "扫脸拍照或在线答题，快速测出你的专属肤质类型，精准匹配科学护肤方案与好物推荐。",
  keywords: [
    "AI护肤", "肤质测试", "面部识别", "护肤顾问", "肤质分析",
    "护肤品推荐", "AI测肤", "敏感肌", "油性皮肤", "干性皮肤",
    "NIHPLOD", "NIHPLOD护肤", "NIHPLOD测肤", "NIHPLOD官网",
    "NIHPLOD皮肤测试", "NIHPLOD AI", "NIHPLOD 人工智能",
    "nihplod skincare", "nihplod skin test", "nihplod beauty",
    "旎柏", "旎柏护肤", "NIHPLOD 怎么样", "NIHPLOD 评价",
    "肌智派", "肌智派AI", "肌智派活动", "肌智派送好礼",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "NIHPLOD | 肌智派素颜测肤",
    description:
      "扫脸拍照或在线答题，快速测出你的专属肤质类型，精准匹配科学护肤方案与好物推荐。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "NIHPLOD | 肌智派素颜测肤",
    description:
      "扫脸拍照或在线答题，快速测出你的专属肤质类型，精准匹配科学护肤方案。",
  },
});

export default function HomePage() {
  return <HomeClient />;
}
