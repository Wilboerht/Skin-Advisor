import type { MetadataRoute } from "next";
import { routeOrder } from "@/lib/result-content";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

const lastModified = new Date();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 静态页面
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/skin-types`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/services`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/gift`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/community`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // 8 种肤质类型页面
  const skinTypePages: MetadataRoute.Sitemap = routeOrder.map((route) => ({
    url: `${baseUrl}/skin-types/${route}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...skinTypePages];
}
