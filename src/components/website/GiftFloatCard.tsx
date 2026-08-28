"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";

/**
 * 右下角悬浮"测肤有礼"入口按钮。
 * - 传入 onClick 时渲染 <button>（如首页直接打开活动弹窗）
 * - 否则渲染指向 /?gift=1 的 <Link>（由 GiftParamDetector 打开弹窗）
 */
export function GiftFloatCard({ onClick }: { onClick?: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const className =
    "group flex items-center gap-2 rounded-full bg-[#5c4937] pl-3.5 pr-5 py-3 text-sm text-[#FDFBF7] tracking-[0.08em] shadow-[0_8px_24px_rgba(92,73,55,0.35)] transition-all duration-300 hover:bg-[#4a3a2c] hover:shadow-[0_10px_28px_rgba(92,73,55,0.45)] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c4937]/40 cursor-pointer";

  const content = (
    <>
      <Gift
        className="w-4 h-4 animate-[soft-blink_3s_ease-in-out_infinite]"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span>测肤有礼</span>
    </>
  );

  return (
    <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-5 md:bottom-6 md:right-8 z-[9999]">
      {onClick ? (
        <button type="button" onClick={onClick} className={className}>
          {content}
        </button>
      ) : (
        <Link href="/?gift=1" className={className}>
          {content}
        </Link>
      )}
    </div>
  );
}
