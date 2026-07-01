"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export function GiftFloatCard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-3 right-6 md:bottom-4 md:right-8 z-[9999]">
      <Link
        href="/gift"
        className="group flex items-center gap-2 text-sm text-[#8B7355] hover:text-[#5c4937] transition-colors duration-300"
      >
        <Image
          src="/images/watermark.png"
          alt=""
          width={36}
          height={36}
          className="w-8 h-8 object-contain transition-opacity duration-300 drop-shadow-[0_1px_1px_rgba(61,68,48,0.25)] animate-[soft-blink_3s_ease-in-out_infinite]"
          unoptimized
        />
        <span className="tracking-[0.05em]">肌智派送好礼</span>
      </Link>

      <style>{`
        @keyframes soft-blink {
          0%, 100% { opacity: 0.88; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
