import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import GiftClient from "./GiftClient";

export const dynamic = "force-dynamic";
export const revalidate = 300;

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

export default async function GiftPage() {
  const campaign = await prisma.campaign.findFirst({
    where: { status: "active", startDate: { lte: new Date() }, endDate: { gte: new Date() } },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { entries: true } } },
  });

  const campaignData = campaign
    ? {
        id: campaign.id,
        title: campaign.title,
        subtitle: campaign.subtitle,
        description: campaign.description,
        coverImage: campaign.coverImage,
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
        drawDate: campaign.drawDate?.toISOString() ?? null,
        prizes: campaign.prizes as Array<{ name: string; image: string; quantity: number; description?: string }>,
        shareText: campaign.shareText,
        rules: campaign.rules,
        maxEntries: campaign.maxEntries,
        entryCount: campaign._count.entries,
        winnerIds: campaign.winnerIds as string[] | null,
      }
    : null;

  return <GiftClient serverCampaign={campaignData} />;
}
