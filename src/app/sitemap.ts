import type { MetadataRoute } from "next";
import { routeOrder } from "@/lib/result-content";
import prisma from "@/lib/prisma";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 静态页面
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/skin-types`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/gift`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // 8 种肤质类型页面
  const skinTypePages: MetadataRoute.Sitemap = routeOrder.map((route) => ({
    url: `${baseUrl}/skin-types/${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // 动态产品页面（如果有产品数据）
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { id: true, updatedAt: true, name: true },
      take: 500,
    });
    productPages = products.map((p) => ({
      url: `${baseUrl}/skin-types/${encodeURIComponent(p.name)}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
  } catch {
    // 数据库不可用时跳过
  }

  return [...staticPages, ...skinTypePages, ...productPages];
}
