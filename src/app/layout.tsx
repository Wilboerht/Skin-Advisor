import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NIHPLOD Skin Advisor - AI 智能护肤顾问",
  description: "基于 AI 面部识别技术的专业护肤分析与定制化方案推荐",
};

import { ViewTransitions } from "next-view-transitions";

import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ToastProvider>
            {children}
          </ToastProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
