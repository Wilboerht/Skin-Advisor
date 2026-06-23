"use client";

import { useState } from "react";
import { m } from "framer-motion";
import Image from "next/image";
import { BaseModal } from "@/components/ui/BaseModal";

interface LetterEnvelopeProps {
  letterImageSrc?: string;
  alt?: string;
}

export function LetterEnvelope({ letterImageSrc, alt }: LetterEnvelopeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  const handleOpen = () => {
    if (isOpening || isOpen) return;
    setIsOpening(true);
    setTimeout(() => {
      setIsOpen(true);
      setIsOpening(false);
    }, 600);
  };

  return (
    <>
      <div className="flex flex-col items-center">
        <button
          onClick={handleOpen}
          className="relative group cursor-pointer focus:outline-none"
          aria-label="打开信件"
        >
          <div className="relative w-56 h-36 md:w-72 md:h-44">
            {/* 信封阴影 */}
            <div className="absolute inset-0 rounded-sm shadow-[0_12px_32px_rgba(61,68,48,0.12)]" />

            {/* 信封后层 */}
            <div className="absolute inset-0 rounded-sm bg-[#E8E2D9]" />

            {/* 信件纸 */}
            <m.div
              className="absolute left-3 right-3 top-2 bottom-0 bg-white rounded-t-sm shadow-sm"
              initial={{ y: 0 }}
              animate={{ y: isOpening ? -16 : 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="absolute top-4 left-5 right-5 space-y-2">
                <div className="h-1.5 bg-[#E8E2D9]/60 rounded-full w-3/4" />
                <div className="h-1.5 bg-[#E8E2D9]/40 rounded-full w-full" />
                <div className="h-1.5 bg-[#E8E2D9]/40 rounded-full w-5/6" />
              </div>
            </m.div>

            {/* 左右侧翻盖 */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[45%] bg-[#F0EDE1]"
              style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-[45%] bg-[#F0EDE1]"
              style={{ clipPath: "polygon(100% 0, 0 50%, 100% 100%)" }}
            />

            {/* 底部翻盖 */}
            <div
              className="absolute left-0 right-0 bottom-0 h-[55%] bg-[#EDE8DF]"
              style={{ clipPath: "polygon(0 100%, 50% 0, 100% 100%)" }}
            />

            {/* 可打开的顶部翻盖 */}
            <m.div
              className="absolute left-0 right-0 top-0 h-[55%] bg-[#F5F2ED] origin-top"
              style={{ clipPath: "polygon(0 0, 50% 100%, 100% 0)" }}
              initial={{ rotateX: 0 }}
              animate={{ rotateX: isOpening ? -180 : 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* 蜡封 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 md:w-11 md:h-11 rounded-full bg-[#1B3A5C]/10 border border-[#1B3A5C]/20 backdrop-blur-sm flex items-center justify-center z-10">
              <span className="text-[#1B3A5C] text-[9px] md:text-[10px] tracking-widest font-medium">N</span>
            </div>
          </div>
        </button>
        <p className="mt-5 text-[13px] text-[#5E5E5E] font-light tracking-wide">
          点击打开信件
        </p>
      </div>

      <BaseModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="p-0 bg-[#F8F7F3] overflow-hidden w-full max-w-2xl"
        showCloseButton={true}
      >
        <div className="relative w-full aspect-[3/4] md:aspect-[4/3]">
          {letterImageSrc ? (
            <Image
              src={letterImageSrc}
              alt={alt || "信件"}
              fill
              className="object-contain p-4"
              sizes="(max-width: 768px) 100vw, 672px"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#5E5E5E] font-light gap-3">
              <div className="w-16 h-16 rounded-full bg-[#E8E2D9]/50 flex items-center justify-center">
                <span className="text-2xl text-[#1B3A5C]/30">✉</span>
              </div>
              <span className="text-sm tracking-wide">信件图片占位</span>
            </div>
          )}
        </div>
      </BaseModal>
    </>
  );
}
