import type { Metadata } from "next";
import HomeClient from "@/components/website/HomeClient";
import { withDefaultOgImage } from "@/lib/metadata";

export const revalidate = 3600;

export const metadata: Metadata = withDefaultOgImage({
  title: "NIHPLOD | 肌智派在线测肤",
  description:
    "扫脸拍照或在线答题，快速测出你的专属肤质类型，精准匹配科学护肤方案与好物推荐。",
  alternates: { canonical: "/" },
  openGraph: {
    title: "NIHPLOD | 肌智派在线测肤",
    description:
      "扫脸拍照或在线答题，快速测出你的专属肤质类型，精准匹配科学护肤方案与好物推荐。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "NIHPLOD | 肌智派在线测肤",
    description:
      "扫脸拍照或在线答题，快速测出你的专属肤质类型，精准匹配科学护肤方案。",
  },
});

export default function HomePage() {
  return <HomeClient />;
}
