import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "面部扫描",
  description: "拍摄面部照片，AI 深度学习精准分析你的肤质类型。",
};

export default function FaceScanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
