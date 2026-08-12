import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "404 - 页面未找到",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-[#FDFBF7] text-[#1A1A1A] px-6 text-center">
      <p className="text-[80px] md:text-[120px] font-serif text-[#8B7355]/30 leading-none mb-4">
        404
      </p>
      <h1 className="text-xl md:text-2xl font-serif mb-3">页面未找到</h1>
      <p className="text-[14px] text-[#5E5E5E] font-light max-w-md mb-8 leading-relaxed">
         您访问的页面可能已移动或暂时不可用。不如回到首页，开始一次 AI 肤质分析？
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-8 py-3 border border-[#1B3A5C] text-[#1B3A5C] rounded-lg text-[13px] tracking-[0.1em] font-medium hover:bg-[#1B3A5C] hover:text-white transition-all duration-500"
      >
        回到首页
        <ArrowRight className="w-4 h-4" />
      </Link>
    </main>
  );
}
