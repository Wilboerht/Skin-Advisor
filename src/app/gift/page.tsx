import type { Metadata } from "next";
import GiftClient from "./GiftClient";

export const metadata: Metadata = {
  title: "肌智派送好礼 — 参与活动赢取护肤礼包",
  description: "完成 NIHPLOD AI 测肤并分享至小红书，即可参与「肌智派」抽奖活动，赢取精选护肤好礼。",
  keywords: ["NIHPLOD", "肌智派", "护肤抽奖", "AI测肤活动", "小红书分享", "护肤礼包"],
  openGraph: {
    title: "NIHPLOD 肌智派 · 分享测肤赢好礼",
    description: "完成 AI 测肤，分享小红书，参与抽奖赢取护肤礼包。",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "NIHPLOD 肌智派活动" }],
  },
};

export default function GiftPage() {
  return <GiftClient />;
}
