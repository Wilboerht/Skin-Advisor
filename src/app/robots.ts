import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/test-background/", "/result", "/reports/", "/face-scan/", "/questions/"],
      },
      // AI 爬虫白名单：允许抓取内容页
      {
        userAgent: "GPTBot",
        allow: ["/", "/skin-types/", "/services/", "/faq/", "/gift/"],
        disallow: ["/admin/", "/api/", "/result", "/reports/"],
      },
      {
        userAgent: "CCBot",
        allow: ["/", "/skin-types/", "/services/", "/faq/"],
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "anthropic-ai",
        allow: ["/", "/skin-types/", "/services/", "/faq/"],
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "Google-Extended",
        allow: ["/", "/skin-types/", "/services/", "/faq/"],
        disallow: ["/admin/", "/api/"],
      },
      // 百度爬虫
      {
        userAgent: "Baiduspider",
        allow: ["/", "/skin-types/", "/services/", "/faq/", "/gift/"],
        disallow: ["/admin/", "/api/", "/result", "/reports/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
