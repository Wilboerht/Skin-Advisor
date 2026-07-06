import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 成本分析",
  description: "NIHPLOD 管理后台 — AI 调用成本与用量统计。",
};

export default function AiCostsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
