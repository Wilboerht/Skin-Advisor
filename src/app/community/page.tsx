import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import CommunityClient from "./CommunityClient";
import { withDefaultOgImage } from "@/lib/metadata";
import { BreadcrumbSchema } from "@/components/website/StructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

export const revalidate = 120;

export const metadata: Metadata = withDefaultOgImage({
  title: "真实用户反馈 · 肌智派社区",
  description: "查看 #肌智派送好礼 真实用户的前后对比与护肤心得，分享你的故事获取额外测肤机会。",
  keywords: ["NIHPLOD", "肌智派", "真实用户反馈", "前后对比", "护肤心得", "小红书", "肌智派送好礼"],
  alternates: { canonical: "/community" },
  openGraph: {
    title: "NIHPLOD 肌智派 · 真实用户反馈社区",
    description: "真实用户的前后对比与护肤心得，分享你的故事解锁额外测肤。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "NIHPLOD 肌智派 · 真实用户反馈社区",
    description: "真实用户的前后对比与护肤心得。",
  },
});

export default async function CommunityPage() {
  // 构建时 DB 不可用则降级为空，运行时 ISR 重新获取
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let verifiedEntries: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let approvedPosts: any[] = [];
  let campaignCount = 0;
  let postCount = 0;

  try {
    [verifiedEntries, approvedPosts, [campaignCount, postCount]] = await Promise.all([
      prisma.campaignEntry.findMany({
        where: { status: "verified", shareLink: { not: null } },
        orderBy: { verifiedAt: "desc" },
        take: 6,
        select: {
          id: true,
          shareLink: true,
          verifiedAt: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
      prisma.communityPost.findMany({
        where: { status: "approved" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          beforeImage: true,
          afterImage: true,
          note: true,
          personaLabel: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
      prisma.$transaction([
        prisma.campaignEntry.count({ where: { status: "verified", shareLink: { not: null } } }),
        prisma.communityPost.count({ where: { status: "approved" } }),
      ]),
    ]);
  } catch {
    // 构建时数据库不可用则降级为空状态（运行时 ISR 会重新获取）
  }

  const total = campaignCount + postCount;
  const totalPages = Math.max(1, Math.ceil(total / 12));

  // 转换 CampaignEntry → XHS 帖子
  const xhsPosts = verifiedEntries.map((e) => ({
    type: "xhs" as const,
    id: e.id,
    shareLink: e.shareLink,
    userName: e.user?.name || "匿名用户",
    createdAt: (e.verifiedAt || e.createdAt).toISOString(),
  }));

  // 转换 CommunityPost → Direct 帖子
  const directPosts = approvedPosts.map((p) => ({
    type: "direct" as const,
    id: p.id,
    beforeImage: p.beforeImage,
    afterImage: p.afterImage,
    note: p.note,
    personaLabel: p.personaLabel,
    userName: p.user?.name || "匿名用户",
    createdAt: p.createdAt.toISOString(),
  }));

  const initialPosts = [...xhsPosts, ...directPosts];

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "首页", url: BASE_URL },
          { name: "真实反馈社区", url: `${BASE_URL}/community` },
        ]}
      />
      <CommunityClient
        initialPosts={initialPosts}
        pagination={{ page: 1, totalPages, total }}
      />
    </>
  );
}
