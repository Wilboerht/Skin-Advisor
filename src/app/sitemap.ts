import type { MetadataRoute } from "next";
import { routeOrder } from "@/lib/result-content";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

// 内容最近实际更新日期（内容变更时手动维护，避免每次构建输出假新鲜度）
const CONTENT_UPDATED_AT = new Date("2026-08-11");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 静态页面
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: CONTENT_UPDATED_AT,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/skin-types`,
      lastModified: CONTENT_UPDATED_AT,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: CONTENT_UPDATED_AT,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // 8 种肤质类型页面
  const skinTypePages: MetadataRoute.Sitemap = routeOrder.map((route) => ({
    url: `${baseUrl}/skin-types/${route}`,
    lastModified: CONTENT_UPDATED_AT,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...skinTypePages];
}
