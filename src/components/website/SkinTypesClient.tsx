"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkinTypeData } from "@/lib/result-content";
import { SkinTypeModal } from "@/components/website/SkinTypeModal";
import { getFactionIcon, getFactionEdgeTexture } from "@/components/website/faction-icons";

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
  // 派系菜单 chip 引用：切换焦点后把当前 chip 滚入可视区（移动端横向滚动场景）
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const step = (dir: 1 | -1) =>
    setActiveIdx((prev) => (prev + dir + types.length) % types.length);

  // 焦点变化：菜单里对应 chip 滚动到可视中心
  useEffect(() => {
    chipRefs.current[activeIdx]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeIdx]);

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
      {/* 派系导航说明：置于轮播上方，与 hero 副标题同字号，主色 #00263E */}
      <p className="mb-4 flex items-center justify-center gap-1.5 text-center text-[13px] md:text-sm text-[#00263E] font-light tracking-[0.06em]">
        点击对应派系，查看派系详情
        <ArrowDown className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
      </p>

      {/* 外层相对容器：轮播裁剪区 + 两侧翻页按钮（按钮在裁剪容器外，垂直线与卡片舞台中线对齐） */}
      <div className="relative">
        {/* 平面轮播（无 3D 透视）：overflow-hidden 裁剪远端卡防横向页面溢出 */}
        <div
          className="relative w-full overflow-hidden select-none"
          onTouchStart={onCarouselTouchStart}
          onTouchEnd={onCarouselTouchEnd}
        >
          {/* 卡片舞台：高度与中央卡一致；--fan-offset 控制相邻卡的横向展开距离（移动端/桌面分开） */}
          <div className="relative h-[210px] md:h-[360px] [--fan-offset:130px] md:[--fan-offset:150px]">
            {/* 环境光晕：舞台后方的柔光椭圆，给平面布局一点空气感 */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] h-[85%] bg-brand-charcoal/[0.03] rounded-full blur-[70px] pointer-events-none"
            />
            {types.map((type, i) => {
              const d = offsetOf(i, activeIdx, types.length);
              const abs = Math.abs(d);
              const isCenter = abs === 0;
              const Icon = getFactionIcon(type.ipKey);
              // 大小与透明度的层级：中央最大，左右各三张依次缩小、越远越透明
              const scale = [1, 0.85, 0.7, 0.58, 0.45][abs] ?? 0.4;
              const opacity = [1, 0.7, 0.45, 0.25, 0.12][abs] ?? 0.1;
              // 失焦层级：离中央越远，内容越模糊、遮罩越重，凸显中央卡
              const blurPx = [0, 2.5, 4, 6, 8][abs] ?? 10;
              const veilOpacity = [0, 0.15, 0.3, 0.42, 0.55][abs] ?? 0.6;
              // 平面层叠：仅横向展开 + 层级缩放，无旋转角度；垂直 -50% 居中
              const transform = `translate(calc(-50% + ${d} * var(--fan-offset)), -50%) scale(${scale})`;
              const zIndex = 10 - abs;
              // 第四张起完全隐藏，不接收点击（避免"点空气"聚焦到不可见卡片）
              const hidden = abs >= 4;

              return (
                <button
                  key={type.route}
                  type="button"
                  onClick={() => (isCenter ? setSelected(type) : setActiveIdx(i))}
                  aria-label={isCenter ? `${type.typeName}（查看详情）` : type.typeName}
                  aria-hidden={hidden}
                  tabIndex={isCenter ? 0 : -1}
                  className="absolute left-1/2 top-1/2 w-[280px] md:w-[500px] aspect-[16/10] rounded-2xl border border-brand-espresso/[0.07] bg-white p-4 md:p-5 text-left cursor-pointer motion-reduce:transition-none"
                  style={{
                    transform,
                    opacity,
                    zIndex,
                    filter: isCenter ? "none" : `blur(${blurPx}px)`,
                    pointerEvents: hidden ? "none" : "auto",
                    // 已隐藏的远端卡不参与绘制，节省合成开销
                    visibility: hidden ? "hidden" : "visible",
                    // 中央卡保留极轻的多层空气感投影，侧卡保持无影平面，形成"浮起"层次
                    boxShadow: isCenter
                      ? "0 2px 6px rgba(61,47,37,0.04), 0 14px 32px rgba(61,47,37,0.06), 0 32px 64px -20px rgba(61,47,37,0.10)"
                      : "none",
                    // 只过渡合成器友好的属性；z-index/pointer-events 等离散属性即时切换，
                    // 避免 transition-all 造成的"中途跳层级"卡顿观感
                    transition: "transform 500ms cubic-bezier(0.16,1,0.3,1), opacity 500ms cubic-bezier(0.16,1,0.3,1), filter 500ms cubic-bezier(0.16,1,0.3,1)",
                    // 提前提升为独立合成层，避免首帧动画才触发层提升导致的掉帧
                    willChange: "transform, opacity, filter",
                  }}
                >
                  {/* 侧卡失焦遮罩：常驻挂载（中央卡 opacity 0），随层级平滑淡入淡出，避免中途卸载造成的"闪变" */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl bg-white pointer-events-none transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                    style={{ opacity: isCenter ? 0 : veilOpacity }}
                  />
                  {/* 派系边缘纹理：卡片顶部饰条，颜色与图案契合各派系气质 */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-[6px] rounded-t-2xl pointer-events-none"
                    style={{ background: getFactionEdgeTexture(type.ipKey) }}
                  />
                {/* 横向结构：左形象 40% + 右文字 60%（4:6） */}
                <div className="flex h-full items-center gap-3 md:gap-5">
                  <div className="flex-[4_1_0%] min-w-0 h-full flex items-center justify-center">
                    <Image
                      src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
                      alt=""
                      width={180}
                      height={180}
                      className="w-full max-w-[112px] md:max-w-[184px] h-auto object-contain pointer-events-none"
                    />
                  </div>
                  <div className="flex-[6_1_0%] min-w-0">
                      <h2 className="text-lg md:text-xl font-serif font-light tracking-[0.02em] text-brand-charcoal inline-flex items-center gap-1.5">
                        <Icon className="w-4 h-4 md:w-5 md:h-5 text-brand-charcoal/60 shrink-0" strokeWidth={1.5} />
                        {type.typeName}
                      </h2>
                      {/* 简介与入口常驻挂载，随聚焦状态淡入淡出：避免切换瞬间插入 DOM 导致图层重栅格化掉帧 */}
                      <p
                        className="mt-1.5 text-[12px] md:text-[13px] text-brand-charcoal/60 font-light leading-relaxed line-clamp-2 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                        style={{ opacity: isCenter ? 1 : 0 }}
                      >
                        {type.m1.persona}
                      </p>
                      <div
                        className="mt-3 inline-flex items-center text-xs md:text-[13px] font-light tracking-[0.12em] text-brand-charcoal/60 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                        style={{ opacity: isCenter ? 1 : 0 }}
                      >
                        查看完整解读
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </div>
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
          className="group hidden md:flex absolute -left-4 lg:-left-8 top-[105px] md:top-[180px] -translate-y-1/2 z-30 w-11 h-11 items-center justify-center rounded-full border border-brand-espresso/[0.12] bg-white/70 backdrop-blur-sm text-brand-charcoal/45 hover:bg-white hover:border-brand-espresso/30 hover:text-brand-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 transition-colors duration-300 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-0.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="下一个"
          className="group hidden md:flex absolute -right-4 lg:-right-8 top-[105px] md:top-[180px] -translate-y-1/2 z-30 w-11 h-11 items-center justify-center rounded-full border border-brand-espresso/[0.12] bg-white/70 backdrop-blur-sm text-brand-charcoal/45 hover:bg-white hover:border-brand-espresso/30 hover:text-brand-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 transition-colors duration-300 cursor-pointer"
        >
          <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* 派系导航（替代原进度圆点指示器）：全部派系（名称 + 图标），点击聚焦对应卡片；
          激活 chip 实心高亮即当前位置指示；移动端横向滚动 + 边缘渐隐提示可滑，桌面端换行居中 */}
      <div className="mt-5 flex gap-2 overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)] md:flex-wrap md:justify-center md:overflow-visible md:[mask-image:none]">
        {types.map((t, i) => {
          const active = i === activeIdx;
          const Icon = getFactionIcon(t.ipKey);
          return (
            <button
              key={t.route}
              type="button"
              ref={(el) => { chipRefs.current[i] = el; }}
              onClick={() => setActiveIdx(i)}
              aria-pressed={active}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] tracking-[0.04em] transition-colors duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 focus-visible:ring-offset-2",
                active
                  ? "border border-brand-charcoal/[0.18] bg-brand-charcoal/[0.06] text-brand-charcoal font-medium"
                  : "border border-transparent text-brand-charcoal/45 font-light hover:text-brand-charcoal/70 hover:bg-brand-charcoal/[0.03]"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={active ? 1.75 : 1.5} />
              {t.typeName}
            </button>
          );
        })}
      </div>

      <SkinTypeModal data={selected} onClose={() => setSelected(null)} />
    </>
  );
}
