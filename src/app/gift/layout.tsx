import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "礼品活动",
  description: "参与 NIHPLOD 活动赢取护肤好礼。",
};

export default function GiftLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
