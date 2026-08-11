/**
 * 结构化数据 (JSON-LD) 组件集
 * 用于 SEO 富文本结果和 GEO (生成式引擎优化)
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

// ============================================================
// 全站 Organization Schema
// ============================================================
export function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "NIHPLOD",
    url: BASE_URL,
    logo: `${BASE_URL}/images/watermark.png`,
    description:
      "基于 AI 面部识别技术的专业护肤分析与个性化护肤方案推荐平台，支持 8 种肌肤形象类型检测。",
    foundingDate: "2024",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: ["Chinese"],
    },
    sameAs: [
      "https://www.xiaohongshu.com/user/profile/nihplod",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================================
// 首页 WebApplication Schema
// ============================================================
export function WebApplicationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "NIHPLOD AI 护肤顾问",
    url: BASE_URL,
    description:
      "AI 驱动的面部识别肤质分析与个性化护肤品推荐工具。上传自拍或填写问卷，获取专业护肤报告。",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CNY",
    },
    featureList: [
      "AI 面部特征检测",
      "68 点面部特征分析",
      "8 种肤质类型分类",
      "个性化产品推荐",
      "专业护肤报告生成",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================================
// 面包屑 BreadcrumbList Schema
// ============================================================
interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================================
// FAQ 页面 Schema
// ============================================================
interface FAQItem {
  question: string;
  answer: string;
}

export function FAQPageSchema({ faqs }: { faqs: FAQItem[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================================
// 肤质文章 Article Schema（用于 skin-types/[type] 页面）
// ============================================================
export function ArticleSchema({
  headline,
  description,
  image,
  datePublished,
  dateModified,
  authorName = "NIHPLOD",
  url,
}: {
  headline: string;
  description: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  url: string;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    author: {
      "@type": "Organization",
      name: authorName,
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "NIHPLOD",
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/images/watermark.png`,
      },
    },
    datePublished: datePublished || "2024-01-01",
    dateModified: dateModified || new Date().toISOString().split("T")[0],
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };

  if (image) {
    schema.image = image;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================================
// 产品 Product Schema
// ============================================================
export function ProductSchema({
  name,
  description,
  image,
  category,
  price,
  brand = "NIHPLOD",
}: {
  name: string;
  description: string;
  image: string;
  category: string;
  price?: string;
  brand?: string;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image,
    brand: {
      "@type": "Brand",
      name: brand,
    },
    category,
  };

  if (price) {
    schema.offers = {
      "@type": "Offer",
      price,
      priceCurrency: "CNY",
      availability: "https://schema.org/InStock",
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================================
// 网站搜索框 Sitelinks Searchbox Schema（首页用）
// ============================================================
export function WebsiteSearchSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: BASE_URL,
    name: "NIHPLOD AI 护肤顾问",
    description:
      "基于 AI 面部识别技术的专业护肤分析平台",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
