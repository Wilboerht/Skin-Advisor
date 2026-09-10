"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { SkinTypeData } from "@/lib/result-content";
import { SkinTypeModal } from "@/components/website/SkinTypeModal";

interface SkinTypesClientProps {
  types: SkinTypeData[];
}

/**
 * SkinTypesClient — 肌智派横向滚动画廊（传送带式）
 * 8 张派系卡横排滚动（snap 吸附 + 两端渐隐 + 桌面左右箭头），点击卡片打开详情弹窗。
 * 移动端/PC 同一套交互：手指/滚轮横滑。
 */
export function SkinTypesClient({ types }: SkinTypesClientProps) {
  const [selected, setSelected] = useState<SkinTypeData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 按卡片宽度 + 间距滚动一屏
  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-type-card]");
    const step = card ? card.offsetWidth + 20 : 320;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <>
      <div className="relative">
        {/* 横向滚动画廊 */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 pt-2"
        >
          {types.map((type) => (
            <button
              key={type.route}
              data-type-card
              type="button"
              onClick={() => setSelected(type)}
              className="group relative shrink-0 snap-start w-[260px] md:w-[300px] rounded-2xl border border-brand-espresso/[0.08] bg-gradient-to-br from-white to-[#FBF7EE] shadow-[0_8px_24px_rgba(61,47,37,0.06)] p-5 text-left cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(61,47,37,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <Image
                src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
                alt=""
                width={240}
                height={240}
                className="w-full h-[200px] md:h-[240px] object-contain mx-auto mb-4 group-hover:scale-105 transition-transform duration-500"
              />
              <h2 className="text-lg md:text-xl font-serif font-light tracking-[0.02em] text-brand-charcoal">
                {type.typeName}
              </h2>
              <p className="mt-1.5 text-[12px] md:text-[13px] text-brand-charcoal/60 font-light leading-relaxed line-clamp-2 min-h-[2.6em]">
                {type.m1.persona}
              </p>
              <div className="mt-4 inline-flex items-center text-xs md:text-[13px] font-light tracking-[0.12em] text-brand-charcoal/60 group-hover:text-brand-charcoal-light transition-colors duration-300">
                查看完整解读
                <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform duration-500 group-hover:translate-x-1.5" />
              </div>
            </button>
          ))}
        </div>

        {/* 两端渐隐遮罩：提示可横向滑动 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-8 md:w-16 bg-gradient-to-r from-[#FBF7EE] to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 md:w-16 bg-gradient-to-l from-[#FBF7EE] to-transparent"
        />

        {/* 桌面左右箭头 */}
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          aria-label="向左浏览"
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/90 border border-brand-espresso/[0.1] text-brand-charcoal/60 shadow-[0_4px_16px_rgba(61,47,37,0.1)] hover:text-brand-charcoal hover:shadow-[0_8px_24px_rgba(61,47,37,0.16)] transition-all cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          aria-label="向右浏览"
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/90 border border-brand-espresso/[0.1] text-brand-charcoal/60 shadow-[0_4px_16px_rgba(61,47,37,0.1)] hover:text-brand-charcoal hover:shadow-[0_8px_24px_rgba(61,47,37,0.16)] transition-all cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      <SkinTypeModal data={selected} onClose={() => setSelected(null)} />
    </>
  );
}
