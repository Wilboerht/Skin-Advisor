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
      {
        userAgent: "GPTBot",
        allow: ["/", "/skin-types/", "/services/", "/faq/", "/gift/", "/llms.txt", "/llms-full.txt"],
        disallow: ["/admin/", "/api/", "/result", "/reports/"],
      },
      {
        userAgent: "CCBot",
        allow: ["/", "/skin-types/", "/services/", "/faq/", "/gift/", "/llms.txt", "/llms-full.txt"],
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "anthropic-ai",
        allow: ["/", "/skin-types/", "/services/", "/faq/", "/gift/", "/llms.txt", "/llms-full.txt"],
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "Google-Extended",
        allow: ["/", "/skin-types/", "/services/", "/faq/", "/gift/", "/llms.txt", "/llms-full.txt"],
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "Baiduspider",
        allow: ["/", "/skin-types/", "/services/", "/faq/", "/gift/", "/privacy/", "/terms/"],
        disallow: ["/admin/", "/api/", "/result", "/reports/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
