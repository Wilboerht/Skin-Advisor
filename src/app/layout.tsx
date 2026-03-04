import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  title: "NIHPLOD Skin Advisor - AI 智能护肤顾问",
  description: "基于 AI 面部识别技术的专业护肤分析与定制化方案推荐",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
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
      <html lang="en">
        <body
          className={`antialiased`}
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
                <AuthModal />
              </AuthModalProvider>
            </UserProvider>
          </ToastProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
