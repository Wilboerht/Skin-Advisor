import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import GiftClient from "./GiftClient";
import { withDefaultOgImage } from "@/lib/metadata";
import { BreadcrumbSchema } from "@/components/website/StructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

export const revalidate = 300;

export const metadata: Metadata = withDefaultOgImage({
  title: "肌智派送好礼",
  description: "完成 NIHPLOD AI 测肤并分享至小红书，即可参与「肌智派」抽奖活动，赢取精选护肤好礼。",
  keywords: ["NIHPLOD", "肌智派", "护肤抽奖", "AI测肤活动", "小红书分享", "护肤礼包"],
  alternates: { canonical: "/gift" },
  openGraph: {
    title: "NIHPLOD 肌智派 · 分享测肤赢好礼",
    description: "完成 AI 测肤，分享小红书，参与抽奖赢取护肤礼包。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "NIHPLOD 肌智派 · 分享测肤赢好礼",
    description: "完成 AI 测肤，分享小红书，参与抽奖赢取护肤礼包。",
  },
});

export default async function GiftPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let campaign: any = null;
  try {
    campaign = await prisma.campaign.findFirst({
      where: { status: "active", startDate: { lte: new Date() }, endDate: { gte: new Date() } },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { entries: true } } },
    });
  } catch {
    // 构建时数据库不可用则降级为空活动（运行时 ISR 会重新获取）
  }

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

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "首页", url: BASE_URL },
          { name: "肌智派送好礼", url: `${BASE_URL}/gift` },
        ]}
      />
      {/* Event Schema injected client-side via GiftClient */}
      <GiftClient serverCampaign={campaignData} />
    </>
  );
}
