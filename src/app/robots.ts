import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

const PRIVATE_PATHS = [
  "/admin",
  "/api",
  "/result",
  "/reports",
  "/face-scan",
  "/questions",
];

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Google-CloudVertexBot",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
  "Amazonbot",
  "cohere-ai",
  "Diffbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
        crawlDelay: 1,
      },
      {
        userAgent: "Baiduspider",
        allow: "/",
        disallow: PRIVATE_PATHS,
        crawlDelay: 1,
      },
      {
        userAgent: AI_CRAWLERS,
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
