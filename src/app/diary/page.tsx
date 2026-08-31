import type { Metadata } from "next";
import { withDefaultOgImage } from "@/lib/metadata";
import DiaryClient from "./DiaryClient";

export const metadata: Metadata = withDefaultOgImage({
  title: "护肤日记",
  description: "每日打卡记录肌肤状态，追踪测肤趋势。",
  robots: { index: false, follow: false },
});

export default function DiaryPage() {
  return <DiaryClient />;
}
