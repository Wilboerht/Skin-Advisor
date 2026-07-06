import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "个人中心",
  description: "查看你的护肤档案与分析历史记录。",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
