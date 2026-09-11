"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { SkinTypeData } from "@/lib/result-content";
import { SkinTypeModal } from "@/components/website/SkinTypeModal";
import { getFactionIcon } from "@/components/website/faction-icons";

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
      {/* 外层相对容器：轮播裁剪区 + 两侧翻页按钮（按钮在裁剪容器外，垂直线与卡片舞台中线对齐） */}
      <div className="relative">
        {/* 平面轮播（无 3D 透视）：overflow-hidden 裁剪远端卡防横向页面溢出 */}
        <div
          className="relative w-full overflow-hidden select-none"
          onTouchStart={onCarouselTouchStart}
          onTouchEnd={onCarouselTouchEnd}
        >
          {/* 卡片舞台：高度与中央卡一致；--fan-offset 控制相邻卡的横向展开距离（移动端/桌面分开） */}
          <div className="relative h-[240px] md:h-[360px] [--fan-offset:130px] md:[--fan-offset:180px]">
            {types.map((type, i) => {
              const d = offsetOf(i, activeIdx, types.length);
              const abs = Math.abs(d);
              const isCenter = abs === 0;
              const Icon = getFactionIcon(type.ipKey);
              // 大小与透明度的层级：中央最大，左右各两张依次缩小、越远越透明
              const scale = [1, 0.85, 0.7, 0.55][abs] ?? 0.5;
              const opacity = [1, 0.7, 0.45, 0.25][abs] ?? 0.15;
              // 失焦层级：离中央越远，内容越模糊、遮罩越重，凸显中央卡
              const blurPx = [0, 2.5, 4, 6][abs] ?? 8;
              const veilOpacity = [0, 0.15, 0.3, 0.42][abs] ?? 0.5;
              // 平面层叠：仅横向展开 + 层级缩放，无旋转角度；垂直 -50% 居中
              const transform = `translate(calc(-50% + ${d} * var(--fan-offset)), -50%) scale(${scale})`;
              const zIndex = 10 - abs;
              // 第三张起完全隐藏，不接收点击（避免"点空气"聚焦到不可见卡片）
              const hidden = abs >= 3;

              return (
                <button
                  key={type.route}
                  type="button"
                  onClick={() => (isCenter ? setSelected(type) : setActiveIdx(i))}
                  aria-label={isCenter ? `${type.typeName}（查看详情）` : type.typeName}
                  aria-hidden={hidden}
                  tabIndex={isCenter ? 0 : -1}
                  className="absolute left-1/2 top-1/2 w-[256px] md:w-[440px] aspect-[4/3] rounded-2xl border border-brand-espresso/[0.07] bg-white p-4 md:p-5 text-left cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  transform,
                  opacity,
                  zIndex,
                  filter: isCenter ? "none" : `blur(${blurPx}px)`,
                  pointerEvents: hidden ? "none" : "auto",
                }}
              >
                {/* 侧卡失焦遮罩：一层半透明白膜，配合 blur 强化"未聚焦"层次 */}
                {!isCenter && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl bg-white pointer-events-none"
                    style={{ opacity: veilOpacity }}
                  />
                )}
                  {/* 横向结构：左形象 + 右文字 */}
                  <div className="flex h-full items-center gap-3 md:gap-5">
                    <Image
                      src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
                      alt=""
                      width={180}
                      height={180}
                      className="shrink-0 w-[128px] h-[128px] md:w-[232px] md:h-[232px] object-contain pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg md:text-xl font-serif font-light tracking-[0.02em] text-brand-charcoal inline-flex items-center gap-1.5">
                        <Icon className="w-4 h-4 md:w-5 md:h-5 text-brand-charcoal/60 shrink-0" strokeWidth={1.5} />
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
        </div>

        {/* 桌面左右翻页按钮：置于裁剪容器外（页边距槽内），垂直对齐舞台中线 */}
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="上一个"
          className="hidden md:flex absolute -left-4 lg:-left-8 top-[120px] md:top-[180px] -translate-y-1/2 z-30 w-10 h-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-brand-espresso/[0.08] text-brand-charcoal/50 hover:text-brand-charcoal hover:bg-white hover:border-brand-espresso/25 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="下一个"
          className="hidden md:flex absolute -right-4 lg:-right-8 top-[120px] md:top-[180px] -translate-y-1/2 z-30 w-10 h-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm border border-brand-espresso/[0.08] text-brand-charcoal/50 hover:text-brand-charcoal hover:bg-white hover:border-brand-espresso/25 transition-all cursor-pointer"
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

      <SkinTypeModal data={selected} onClose={() => setSelected(null)} />
    </>
  );
}
