"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { SkinTypeData } from "@/lib/result-content";
import { SkinTypeModal } from "@/components/website/SkinTypeModal";

interface SkinTypesClientProps {
  types: SkinTypeData[];
  /** ?type=<route> 深链接（服务端解析）的初始选中派系 */
  initialType?: SkinTypeData | null;
}

/** 环形偏移归一化：8 张卡对称排布，d ∈ [-4, 3] */
function offsetOf(i: number, activeIdx: number, total: number): number {
  let d = i - activeIdx;
  if (d > Math.floor(total / 2)) d -= total;
  if (d < -Math.floor(total / 2)) d += total;
  return d;
}

/**
 * SkinTypesClient — 肌智派 3D 旋转木马（Cover Flow 式轮播）
 * 中央卡正面大图，两侧透视缩小，点击侧卡聚焦、中央卡打开详情弹窗；
 * 桌面左右箭头 + 键盘 ←/→，底部进度点指示当前位置。移动端/PC 同构。
 */
export function SkinTypesClient({ types, initialType = null }: SkinTypesClientProps) {
  const [selected, setSelected] = useState<SkinTypeData | null>(initialType);
  const [activeIdx, setActiveIdx] = useState(() => {
    if (initialType) {
      const idx = types.findIndex((t) => t.route === initialType.route);
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // 弹窗内切换派系（循环）
  const navigateType = (delta: number) => {
    setSelected((prev) => {
      if (!prev) return prev;
      const idx = types.findIndex((t) => t.route === prev.route);
      if (idx === -1) return prev;
      const next = (idx + delta + types.length) % types.length;
      return types[next] ?? prev;
    });
  };

  const step = (dir: 1 | -1) =>
    setActiveIdx((prev) => (prev + dir + types.length) % types.length);

  // 键盘 ←/→ 切换（详情弹窗打开时不响应）
  useEffect(() => {
    if (selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- step 仅依赖 types.length（稳定），此处按需忽略
  }, [selected, types.length]);

  const onCarouselTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onCarouselTouchEnd = (e: React.TouchEvent) => {
    const st = touchStartRef.current;
    touchStartRef.current = null;
    if (!st) return;
    const dx = e.changedTouches[0].clientX - st.x;
    const dy = e.changedTouches[0].clientY - st.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      step(dx < 0 ? 1 : -1);
    }
  };

  return (
    <>
      {/* 3D 旋转木马（宽度由父级 80% 容器控制） */}
      <div
        className="relative w-full select-none"
        style={{ perspective: "1200px" }}
        onTouchStart={onCarouselTouchStart}
        onTouchEnd={onCarouselTouchEnd}
      >
        <div className="relative h-[280px] md:h-[320px] flex items-center justify-center">
          {types.map((type, i) => {
            const d = offsetOf(i, activeIdx, types.length);
            const abs = Math.abs(d);
            const isCenter = abs === 0;
            // 变换：环形透视（rotateY + translateZ 缩进），中央正面
            const transform = isCenter
              ? "translateX(-50%) rotateY(0deg) translateZ(0px)"
              : `translateX(-50%) rotateY(${d * -28}deg) translateZ(${-abs * 110}px) scale(${1 - abs * 0.1})`;
            const opacity = abs === 0 ? 1 : abs === 1 ? 0.7 : abs === 2 ? 0.4 : 0;
            const zIndex = 10 - abs;

            return (
              <button
                key={type.route}
                type="button"
                onClick={() => (isCenter ? setSelected(type) : setActiveIdx(i))}
                aria-label={isCenter ? `${type.typeName}（查看详情）` : type.typeName}
                tabIndex={isCenter ? 0 : -1}
                className="absolute left-1/2 top-0 w-[360px] md:w-[440px] rounded-2xl border border-brand-espresso/[0.08] bg-gradient-to-br from-white to-[#FBF7EE] shadow-[0_16px_40px_rgba(61,47,37,0.12)] p-4 md:p-5 text-left cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  transform,
                  opacity,
                  zIndex,
                  transformStyle: "preserve-3d",
                }}
              >
                {/* 横向结构：左形象 + 右文字 */}
                <div className="flex items-center gap-4 md:gap-5">
                  <Image
                    src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
                    alt=""
                    width={180}
                    height={180}
                    className="shrink-0 w-[120px] h-[120px] md:w-[160px] md:h-[160px] object-contain pointer-events-none"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg md:text-xl font-serif font-light tracking-[0.02em] text-brand-charcoal">
                      {type.typeName}
                    </h2>
                    {isCenter && (
                      <>
                        <p className="mt-1.5 text-[12px] md:text-[13px] text-brand-charcoal/60 font-light leading-relaxed line-clamp-2">
                          {type.m1.persona}
                        </p>
                        <div className="mt-3 inline-flex items-center text-xs md:text-[13px] font-light tracking-[0.12em] text-brand-charcoal/60">
                          查看完整解读
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 桌面左右箭头 */}
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="上一个"
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-30 w-10 h-10 items-center justify-center rounded-full bg-white/90 border border-brand-espresso/[0.1] text-brand-charcoal/60 shadow-[0_4px_16px_rgba(61,47,37,0.1)] hover:text-brand-charcoal hover:shadow-[0_8px_24px_rgba(61,47,37,0.16)] transition-all cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="下一个"
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-30 w-10 h-10 items-center justify-center rounded-full bg-white/90 border border-brand-espresso/[0.1] text-brand-charcoal/60 shadow-[0_4px_16px_rgba(61,47,37,0.1)] hover:text-brand-charcoal hover:shadow-[0_8px_24px_rgba(61,47,37,0.16)] transition-all cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* 进度点：当前位置指示（可点击跳转） */}
      <div className="flex items-center justify-center gap-1.5 mt-6" aria-hidden="true">
        {types.map((t, i) => (
          <button
            key={t.route}
            type="button"
            tabIndex={-1}
            onClick={() => setActiveIdx(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIdx ? "w-5 bg-[var(--color-brand-cocoa)]" : "w-1.5 bg-brand-charcoal/15"
            }`}
          />
        ))}
      </div>

      <SkinTypeModal data={selected} onClose={() => setSelected(null)} onNavigate={navigateType} />
    </>
  );
}
