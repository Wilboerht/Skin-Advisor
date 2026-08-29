import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import "./globals.css";
import { OrganizationSchema, WebApplicationSchema, WebsiteSearchSchema } from "@/components/website/StructuredData";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FDFBF7',
  // 品牌浅色站：显式声明，避免浏览器自动深色反转
  colorScheme: 'light',
  // 移动端键盘弹出时调整布局视口，避免输入框/提交按钮被遮挡
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "NIHPLOD | 肌智派素颜测肤",
    template: "%s | NIHPLOD",
  },
  description:
    "扫脸拍照或在线答题，快速测出你的专属肤质类型，精准匹配科学护肤方案与好物推荐。",
  keywords: [
    "AI护肤", "肤质测试", "面部识别", "护肤顾问", "肤质分析",
    "护肤品推荐", "AI测肤", "敏感肌", "油性皮肤", "干性皮肤",
    "NIHPLOD", "NIHPLOD护肤", "NIHPLOD测肤", "NIHPLOD官网",
    "NIHPLOD皮肤测试", "NIHPLOD AI", "NIHPLOD 人工智能",
    "nihplod skincare", "nihplod skin test", "nihplod beauty",
    "旎柏", "旎柏护肤", "NIHPLOD 怎么样", "NIHPLOD 评价",
    "肌智派", "肌智派AI", "肌智派活动", "肌智派送好礼",
  ],
  authors: [{ name: "NIHPLOD", url: BASE_URL }],
  creator: "NIHPLOD",
  publisher: "NIHPLOD",
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "NIHPLOD 肌智派",
    title: "NIHPLOD | 肌智派素颜测肤",
    description:
      "扫脸拍照或在线答题，快速测出你的专属肤质类型，精准匹配科学护肤方案与好物推荐。",
    images: [
      {
        url: "/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "NIHPLOD 肌智派 AI 护肤顾问",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NIHPLOD | 肌智派素颜测肤",
    description:
      "扫脸拍照或在线答题，快速测出你的专属肤质类型，精准匹配科学护肤方案。",
    images: ["/images/og-default.png"],
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
  other: {
    "baidu-site-verification": process.env.BAIDU_SITE_VERIFICATION || "",
    "google-site-verification": process.env.GOOGLE_SITE_VERIFICATION || "",
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/android-chrome-192x192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: [
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
      <html lang="zh-CN" data-scroll-behavior="smooth">
        <head>
          <OrganizationSchema />
          <WebApplicationSchema />
          <WebsiteSearchSchema />
          {process.env.BAIDU_TONGJI_ID && (
            <Script
              id="baidu-tongji"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `var _hmt=_hmt||[];(function(){var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?${process.env.BAIDU_TONGJI_ID}";var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(hm,s);})();`,
              }}
            />
          )}
          {process.env.NEXT_PUBLIC_GA_ID && (
            <>
              <Script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} strategy="afterInteractive" />
              <Script
                id="ga-init"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                  __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_ID}');`,
                }}
              />
            </>
          )}
        </head>
        <body
          className={`antialiased bg-[#FDFBF7]`}
          suppressHydrationWarning
        >
          {/* 键盘/屏幕阅读器用户跳转主内容 */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100200] focus:px-4 focus:py-2 focus:bg-brand-charcoal focus:text-white focus:rounded-lg focus:text-sm"
          >
            跳转到主内容
          </a>
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
