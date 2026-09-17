import type { Metadata } from "next";

// 预览演示页（/preview/*）：仅内部视觉预览，不参与搜索索引
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
