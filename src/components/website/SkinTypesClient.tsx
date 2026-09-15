"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [selected, setSelected] = useState<SkinTypeData | null>(null);
  const [activeIdx, setActiveIdx] = useState(() => {
    if (initialType) {
      const idx = types.findIndex((t) => t.route === initialType.route);
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  // 桌面指针拖拽（鼠标）：记录按下起点与是否产生位移，位移后抑制 click（避免"拖完顺带打开详情"）
  const dragRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const dragMovedRef = useRef(false);
  const router = useRouter();

  const step = (dir: 1 | -1) =>
    setActiveIdx((prev) => (prev + dir + types.length) % types.length);

  // 深链接自动打开详情：仅桌面端（移动端由 SkinTypesMobileList 负责，
  // 避免 display:none 的轮播弹窗在移动端抢占焦点与滚动锁）
  useEffect(() => {
    if (!initialType) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      setSelected(initialType);
    }
  }, [initialType]);

  // 视口缩到移动端时自动关闭详情：组件被 display:none 隐藏后，
  // 弹窗状态与滚动锁会残留（看不见弹窗但整页无法滚动），必须在此释放
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) return;
      setSelected(null);
      if (initialType) router.replace("/skin-types", { scroll: false });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [initialType, router]);

  // 关闭详情弹窗：深链接（?type=xxx）进入时清理 URL，避免刷新后又自动弹出
  const closeDetail = () => {
    setSelected(null);
    if (initialType) router.replace("/skin-types", { scroll: false });
  };

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

  // 桌面鼠标拖拽：惰性指针捕获——仅当确认是拖拽（位移 > 8px）后才 capture，
  // 保证普通点击的 click 事件仍落在卡片按钮上（先捕获会导致点击被容器吞掉）
  const onCarouselPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return; // 触摸走 Touch 逻辑
    dragMovedRef.current = false;
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };
  const onCarouselPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    // 位移超过 8px 视为拖拽：抑制随后的 click，并在此刻才捕获指针
    if (!d.moved && Math.abs(e.clientX - d.x) > 8) {
      d.moved = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch { /* 捕获失败不影响后续逻辑 */ }
    }
  };
  const finishPointerDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || e.pointerId !== d.id) return;
    dragMovedRef.current = d.moved;
    if (cancelled) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      step(dx < 0 ? 1 : -1);
    }
  };

  return (
    <>
      {/* 派系导航：置于轮播上方（替代进度圆点），激活 chip 高亮即当前位置指示；
          紧凑排布——平板固定 4 个一行（受控宽度避免孤儿行），桌面单行 8 个 */}
      <div
        role="group"
        aria-label="派系导航"
        className="mb-4 md:mb-5 mx-auto flex flex-wrap justify-center gap-2 md:max-w-[360px] lg:max-w-none"
      >
        {types.map((t, i) => {
          const active = i === activeIdx;
          const Icon = getFactionIcon(t.ipKey);
          return (
            <button
              key={t.route}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] tracking-[0.04em] transition-colors duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 focus-visible:ring-offset-2",
                active
                  ? "border border-[var(--color-brand-cocoa)]/[0.3] bg-[var(--color-brand-cocoa)]/[0.06] text-[var(--color-brand-cocoa)] font-medium"
                  : "border border-transparent text-brand-charcoal/55 font-light hover:text-brand-charcoal/75 hover:bg-brand-charcoal/[0.03]"
              )}
            >
              <Icon aria-hidden="true" className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              {t.typeName}
            </button>
          );
        })}
      </div>

      {/* 外层相对容器：轮播裁剪区 + 两侧翻页按钮（按钮在裁剪容器外，垂直线与卡片舞台中线对齐） */}
      <div className="relative">
        {/* 平面轮播（无 3D 透视）：overflow-hidden 裁剪远端卡防横向页面溢出；桌面可拖拽 */}
        <div
          className="relative w-full overflow-hidden select-none md:cursor-grab md:active:cursor-grabbing"
          onTouchStart={onCarouselTouchStart}
          onTouchEnd={onCarouselTouchEnd}
          onPointerDown={onCarouselPointerDown}
          onPointerMove={onCarouselPointerMove}
          onPointerUp={(e) => finishPointerDrag(e, false)}
          onPointerCancel={(e) => finishPointerDrag(e, true)}
        >
          {/* 卡片舞台：高度与中央卡一致；--fan-offset 控制相邻卡的横向展开距离（移动端/桌面分开） */}
          <div className="relative h-[210px] md:h-[360px] [--fan-offset:130px] md:[--fan-offset:150px]">
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
                  onClick={() => {
                    // 拖拽产生的 click 抑制一次，避免"拖完顺带翻卡/开弹窗"
                    if (dragMovedRef.current) { dragMovedRef.current = false; return; }
                    if (isCenter) setSelected(type);
                    else setActiveIdx(i);
                  }}
                  aria-label={isCenter ? `${type.typeName}（查看详情）` : type.typeName}
                  aria-hidden={hidden}
                  tabIndex={isCenter ? 0 : -1}
                  className="group absolute left-1/2 top-1/2 w-[280px] md:w-[500px] aspect-[16/10] rounded-2xl border border-brand-espresso/[0.12] bg-white p-4 md:p-5 text-left overflow-hidden hover:border-brand-espresso/[0.22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 motion-reduce:transition-none"
                  style={{
                    transform,
                    opacity,
                    zIndex,
                    filter: isCenter ? "none" : `blur(${blurPx}px)`,
                    pointerEvents: hidden ? "none" : "auto",
                    // 已隐藏的远端卡不参与绘制，节省合成开销
                    visibility: hidden ? "hidden" : "visible",
                    // 只过渡合成器友好的属性；z-index/pointer-events 等离散属性即时切换，
                    // 避免 transition-all 造成的"中途跳层级"卡顿观感
                    transition: "transform 500ms cubic-bezier(0.16,1,0.3,1), opacity 500ms cubic-bezier(0.16,1,0.3,1), filter 500ms cubic-bezier(0.16,1,0.3,1), border-color 300ms ease",
                    // 提前提升为独立合成层，避免首帧动画才触发层提升导致的掉帧；隐藏卡不持有合成层
                    willChange: hidden ? "auto" : "transform, opacity, filter",
                  }}
                >
                  {/* 派系小印章：右下角内侧的规整小圆章（1px 描边 + 图标线稿），像证书角落的钢印；
                      位于白膜之下，侧卡失焦时随卡片一起变淡 */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-3 right-3 md:bottom-5 md:right-5 inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border border-brand-espresso/[0.14]"
                  >
                    <Icon className="w-4 h-4 md:w-[18px] md:h-[18px] text-brand-espresso/35" strokeWidth={1.5} />
                  </span>
                  {/* 侧卡失焦遮罩：常驻挂载（中央卡 opacity 0），随层级平滑淡入淡出，避免中途卸载造成的"闪变" */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl bg-white pointer-events-none transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                    style={{ opacity: isCenter ? 0 : veilOpacity }}
                  />
                {/* 横向结构：左形象 40% + 右文字 60%（4:6）；relative 保证内容在水印之上 */}
                <div className="relative flex h-full items-center gap-3 md:gap-5">
                  <div className="flex-[4_1_0%] min-w-0 h-full flex items-center justify-center">
                    <Image
                      src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
                      alt=""
                      width={180}
                      height={180}
                      loading="lazy"
                      fetchPriority={isCenter ? "high" : "auto"}
                      sizes="184px"
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
                        className="mt-1.5 text-[12px] md:text-[13px] text-brand-charcoal/65 font-light leading-relaxed line-clamp-2 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                        style={{ opacity: isCenter ? 1 : 0 }}
                      >
                        {type.m1.persona}
                      </p>
                      <div
                        className="mt-3 inline-flex items-center text-xs md:text-[13px] font-light tracking-[0.12em] text-brand-charcoal/60 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                        style={{ opacity: isCenter ? 1 : 0 }}
                      >
                        查看完整解读
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
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

      {/* 派系导航已上移至轮播上方 */}

      <SkinTypeModal data={selected} onClose={closeDetail} />
    </>
  );
}
