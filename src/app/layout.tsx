import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { OrganizationSchema, WebsiteSearchSchema } from "@/components/website/StructuredData";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5F2E9',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  title: {
    default: "NIHPLOD | AI 护肤顾问 — 专业 AI 面部识别肤质分析",
    template: "%s | NIHPLOD",
  },
  description:
    "基于 AI 深度学习的面部识别技术，精准分析 8 种肤质类型，量身定制个性化护肤方案与产品推荐。支持 AI 面部扫描 + 智能问答双模式。",
  keywords: [
    "AI护肤", "肤质测试", "面部识别", "护肤顾问", "肤质分析",
    "护肤品推荐", "AI测肤", "敏感肌", "油性皮肤", "干性皮肤",
  ],
  authors: [{ name: "NIHPLOD", url: process.env.NEXT_PUBLIC_BASE_URL }],
  creator: "NIHPLOD",
  publisher: "NIHPLOD",
  formatDetection: { telephone: false },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "NIHPLOD AI 护肤顾问",
    title: "NIHPLOD | AI 护肤顾问 — 专业 AI 面部识别肤质分析",
    description:
      "基于 AI 深度学习的面部识别技术，精准分析 8 种肤质类型，量身定制个性化护肤方案。",
    images: [
      {
        url: "/images/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "NIHPLOD AI 护肤顾问",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NIHPLOD | AI 护肤顾问",
    description:
      "基于 AI 深度学习的面部识别技术，精准分析 8 种肤质类型，量身定制护肤方案。",
    images: ["/images/og-default.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // 百度站长验证（部署时替换为真实 code）
  other: {
    "baidu-site-verification": "",
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
    ],
  },
  manifest: '/site.webmanifest',
};

import { ViewTransitions } from "next-view-transitions";

import { ToastProvider } from "@/components/ui/Toast";
import { UserProvider } from "@/components/auth/UserProvider";


import { AuthModalProvider } from "@/components/auth/AuthModalContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { WebsiteLayoutClient } from "@/components/website/WebsiteLayoutClient";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="zh-CN">
        <head>
          <OrganizationSchema />
          <WebsiteSearchSchema />
        </head>
        <body
          className={`antialiased bg-[#F5F2E9]`}
          suppressHydrationWarning
        >
          <ToastProvider>
            <UserProvider>
              <AuthModalProvider>
                <WebsiteLayoutClient>
                  <main
                    id="main-content"
                    tabIndex={-1}
                    className="relative z-10 pointer-events-none [&>*]:pointer-events-auto min-h-screen"
                  >
                    {children}
                  </main>
                </WebsiteLayoutClient>
                <Suspense fallback={null}>
                  <AuthModal />
                </Suspense>
              </AuthModalProvider>
            </UserProvider>
          </ToastProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
