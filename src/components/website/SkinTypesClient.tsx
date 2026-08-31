"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { SkinTypeData } from "@/lib/result-content";
import { SkinTypeModal } from "@/components/website/SkinTypeModal";

interface SkinTypesClientProps {
  types: SkinTypeData[];
}

/**
 * SkinTypesClient — 肌智派卡片网格 + 详情弹窗
 * 点击卡片打开 SkinTypeModal（原 /skin-types/[type] 独立页已改为弹窗展示）
 */
export function SkinTypesClient({ types }: SkinTypesClientProps) {
  const [selected, setSelected] = useState<SkinTypeData | null>(null);

  return (
    <>
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-x-5 md:gap-x-7 gap-y-6 md:gap-y-10">
        {types.map((type) => (
          <button
            key={type.route}
            type="button"
            onClick={() => setSelected(type)}
            className="group relative rounded-2xl border border-brand-charcoal/[0.08] bg-gradient-to-br from-white to-[#FBF7EE] shadow-[0_8px_24px_rgba(0,38,62,0.06)] p-4 md:p-9 text-left cursor-pointer transition-all duration-500 hover:shadow-[0_24px_48px_rgba(0,38,62,0.12)] hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <Image
              src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
              alt=""
              width={180}
              height={280}
              className="absolute -right-2 -bottom-3 w-[110px] h-[184px] md:w-[152px] md:h-[264px] object-contain opacity-100 group-hover:scale-105 transition-transform duration-500 pointer-events-none select-none"
            />
            <div className="relative z-10 pr-20 md:pr-24">
              <h2 className="text-lg md:text-2xl font-serif font-light tracking-[0.02em] text-brand-charcoal mb-1 md:mb-2 group-hover:text-brand-charcoal-light transition-colors duration-500">
                {type.typeName}
              </h2>
              <p className="text-[13px] md:text-sm text-brand-charcoal/60 font-light tracking-[0.06em] md:tracking-[0.12em] mb-3 md:mb-5 line-clamp-1">
                {type.m1.persona}
              </p>
              <div className="inline-flex items-center text-xs md:text-[13px] font-light tracking-[0.12em] text-brand-charcoal/60 group-hover:text-brand-charcoal-light transition-colors duration-300">
                查看完整解读
                <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform duration-500 group-hover:translate-x-1.5" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <SkinTypeModal data={selected} onClose={() => setSelected(null)} />
    </>
  );
}
