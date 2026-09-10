"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion as m, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { SkinTypeData } from "@/lib/result-content";
import { SkinTypeModal } from "@/components/website/SkinTypeModal";

interface SkinTypesClientProps {
  types: SkinTypeData[];
}

/** 中央舞台：大 IP 形象 + 派系名 + 简介 + 详情按钮（PC 三栏中央 / 移动端横滑头像条下方） */
function Stage({
  active,
  onDetail,
  reduceMotion,
}: {
  active: SkinTypeData;
  onDetail: (t: SkinTypeData) => void;
  reduceMotion: boolean | null;
}) {
  return (
    <div className="relative flex flex-col items-center text-center px-2">
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={active.route}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <Image
            src={`/images/character/${active.ipKey}/${active.ipKey}_female.webp`}
            alt={active.typeName}
            width={340}
            height={340}
            className="w-[240px] lg:w-[320px] h-auto object-contain drop-shadow-[0_16px_32px_rgba(61,47,37,0.16)]"
            priority
          />
          <h2 className="mt-4 lg:mt-6 text-3xl font-serif font-light text-brand-charcoal tracking-[0.04em]">
            {active.typeName}
          </h2>
          <p className="mt-2.5 text-[13px] text-brand-charcoal/60 font-light leading-relaxed max-w-[300px] line-clamp-2">
            {active.m1.persona}
          </p>
          <button
            onClick={() => onDetail(active)}
            className="mt-5 inline-flex items-center gap-2 px-6 h-11 rounded-full bg-[var(--color-brand-cocoa)] text-white text-[13px] font-medium tracking-[0.08em] transition-colors hover:bg-[#4a3a2c]"
          >
            查看完整解读
            <ArrowRight className="w-4 h-4" />
          </button>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * SkinTypesClient — 肌智派"选英雄"式舞台（王者荣耀开局选人版式）
 * PC：左右各 4 个派系头像，中央大舞台展示当前派系；点击头像切换，点击「查看完整解读」打开详情弹窗。
 * 移动端：顶部横滑头像条 + 中央舞台纵向。
 */
export function SkinTypesClient({ types }: SkinTypesClientProps) {
  const [selected, setSelected] = useState<SkinTypeData | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const reduceMotion = useReducedMotion();

  const active = types[Math.min(activeIdx, types.length - 1)] ?? null;
  const leftCol = types.slice(0, 4);
  const rightCol = types.slice(4, 8);

  const selectByIndex = useCallback(
    (i: number) => {
      if (i >= 0 && i < types.length) setActiveIdx(i);
    },
    [types.length]
  );

  // 键盘左右键切换派系（详情弹窗打开时禁用，避免按键穿透到底层舞台）
  useEffect(() => {
    if (selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") selectByIndex(activeIdx - 1);
      if (e.key === "ArrowRight") selectByIndex(activeIdx + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, selectByIndex, selected]);

  // 移动端：选中项自动滚入横滑条可视区（点击半可见头像后平滑居中）
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-portrait-index="${activeIdx}"]`);
    el?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", inline: "center", block: "nearest" });
  }, [activeIdx, reduceMotion]);

  // 移动端：中央舞台左右滑动手势切换派系（横向位移超过 50px 且大于纵向）
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleStageTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleStageTouchEnd = (e: React.TouchEvent) => {
    const st = touchStartRef.current;
    touchStartRef.current = null;
    if (!st) return;
    const dx = e.changedTouches[0].clientX - st.x;
    const dy = e.changedTouches[0].clientY - st.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      selectByIndex(activeIdx + (dx < 0 ? 1 : -1));
    }
  };

  if (!active) return null;

  return (
    <>
      {/* 移动端：顶部横滑头像条（两端渐隐提示可滑动） */}
      <div className="lg:hidden relative -mx-4 px-4 mb-6">
        <div
          ref={stripRef}
          className="flex gap-3 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory"
        >
          {types.map((t, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={t.route}
                type="button"
                data-portrait-index={i}
                onClick={() => setActiveIdx(i)}
                aria-pressed={isActive}
                className={`shrink-0 snap-center flex flex-col items-center gap-1 transition-opacity ${isActive ? "" : "opacity-65"}`}
              >
                <span
                  className={`relative w-12 h-12 rounded-full overflow-hidden ring-2 transition-all ${
                    isActive ? "ring-[var(--color-brand-cocoa)]" : "ring-transparent"
                  }`}
                >
                  <Image
                    src={`/images/character/${t.ipKey}/${t.ipKey}_female.webp`}
                    alt=""
                    fill
                    className="object-cover object-top scale-110"
                  />
                </span>
                <span
                  className={`text-[11px] tracking-[0.04em] ${
                    isActive ? "text-[var(--color-brand-cocoa)] font-medium" : "text-brand-charcoal/55 font-light"
                  }`}
                >
                  {t.typeName}
                </span>
              </button>
            );
          })}
        </div>
        {/* 两端渐隐遮罩：提示内容可横向滑动 */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#FBF7EE] to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#FBF7EE] to-transparent" />
      </div>

      {/* 移动端：中央舞台（支持左右滑动手势切换） */}
      <div
        className="lg:hidden"
        onTouchStart={handleStageTouchStart}
        onTouchEnd={handleStageTouchEnd}
      >
        <Stage active={active} onDetail={setSelected} reduceMotion={reduceMotion} />
      </div>

      {/* PC：三栏舞台（左 4 头像 / 中央 / 右 4 头像） */}
      <div className="hidden lg:grid grid-cols-[1fr_2fr_1fr] gap-8 items-center">
        {/* 左列 */}
        <div className="flex flex-col gap-1">
          {leftCol.map((t, i) => (
            <PortraitButton key={t.route} type={t} index={i} activeIndex={activeIdx} onSelect={setActiveIdx} />
          ))}
        </div>

        {/* 中央舞台 */}
        <Stage active={active} onDetail={setSelected} reduceMotion={reduceMotion} />

        {/* 右列 */}
        <div className="flex flex-col gap-1">
          {rightCol.map((t, i) => (
            <PortraitButton key={t.route} type={t} index={i + 4} activeIndex={activeIdx} onSelect={setActiveIdx} />
          ))}
        </div>
      </div>

      <SkinTypeModal data={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/** 头像按钮：圆形 IP 头像 + 派系名，选中态品牌棕圈 */
function PortraitButton({
  type,
  index,
  activeIndex,
  onSelect,
}: {
  type: SkinTypeData;
  index: number;
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  const isActive = index === activeIndex;
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-pressed={isActive}
      className={`group flex flex-col items-center gap-1.5 w-full py-1.5 rounded-xl transition-colors ${
        isActive ? "" : "hover:bg-brand-charcoal/[0.03]"
      }`}
    >
      <span
        className={`relative w-14 h-14 xl:w-16 xl:h-16 rounded-full overflow-hidden ring-2 transition-all duration-300 ${
          isActive
            ? "ring-[var(--color-brand-cocoa)]"
            : "ring-transparent group-hover:ring-brand-espresso/25"
        }`}
      >
        <Image
          src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
          alt=""
          fill
          className="object-cover object-top scale-110 transition-transform duration-300 group-hover:scale-125"
        />
      </span>
      <span
        className={`text-[11px] xl:text-[12px] tracking-[0.04em] transition-colors ${
          isActive ? "text-[var(--color-brand-cocoa)] font-medium" : "text-brand-charcoal/55 font-light"
        }`}
      >
        {type.typeName}
      </span>
    </button>
  );
}
