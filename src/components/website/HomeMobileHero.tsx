"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowRight, Headset, NotebookPen, ScanFace } from "lucide-react";

import { BookmarkShape } from "@/components/website/HomeFeatureCards";
import { MobileHeroDoodles } from "@/components/website/HeroDoodles";

const DESIGN_WIDTH = 430;
const DESIGN_HEIGHT = 716;

interface HomeMobileHeroProps {
  onStartTest: () => void;
  onOpenProfile: () => void;
  onOpenAdvisor: () => void;
}

const titleClass =
  "block text-[30px] font-semibold leading-[1.12] tracking-[0.06em] text-[#1c1c1c]";
const descClass =
  "block text-[12px] leading-[1.75] tracking-[0.02em] text-[#172B43]/55";
const profileDescClass =
  "block text-[12px] leading-[1.75] tracking-[0.02em] text-[#6C5D53]";

function MobileTab({
  className,
  icon,
  fill,
}: {
  className: string;
  icon: ReactNode;
  fill: string;
}) {
  return (
    <span aria-hidden="true" className={`absolute flex items-center justify-center ${className}`}>
      <BookmarkShape fill={fill} />
      <span className="relative z-10 flex items-center justify-center">{icon}</span>
    </span>
  );
}

export function HomeMobileHero({ onStartTest, onOpenProfile, onOpenAdvisor }: HomeMobileHeroProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isScaled, setIsScaled] = useState(false);
  const [phoneBleed, setPhoneBleed] = useState(0);

  // 768–1023 半屏：以 430×716 手机设计稿为基准整体等比缩放，
  // 保持手机端三卡排列与倾斜角度不变；<768 维持手机原尺寸，≥1024 交给 PC 版
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const update = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        setIsScaled(false);
        setScale(1);
        setPhoneBleed(0);
        return;
      }
      // 用 clientWidth/clientHeight（布局尺寸）而非 getBoundingClientRect：
      // 首页入场动画会对 home-shell 做 0.98 缩放，getBoundingClientRect 会被动画污染导致比例偏小
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;
      const nextScale = Math.min(viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT, 1.5);
      setIsScaled(true);
      setScale(nextScale);
      // 手机端让中间白卡延伸到屏幕右缘；半屏（768–1023）仍保持居中卡片
      setPhoneBleed(
        width < 768 && nextScale > 0
          ? Math.max(0, (viewportWidth / nextScale - DESIGN_WIDTH) / 2)
          : 0
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="relative flex flex-1 overflow-hidden bg-[#F3F1EB] pc:hidden">
      <MobileHeroDoodles />
      <h1 className="sr-only">觉醒你的肌肤派系</h1>
      <div ref={viewportRef} className="relative z-10 flex h-full w-full flex-1 items-center justify-center">
        <div
          className="relative h-full w-full"
          style={isScaled ? { width: DESIGN_WIDTH * scale, height: DESIGN_HEIGHT * scale } : undefined}
        >
        <div
          className="relative mx-auto h-full w-full max-w-[430px]"
          style={
            isScaled
              ? {
                  width: DESIGN_WIDTH,
                  height: DESIGN_HEIGHT,
                  maxWidth: "none",
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }
              : undefined
          }
        >
        <button
          type="button"
          onClick={onOpenAdvisor}
          aria-label="联系专属顾问"
          aria-haspopup="dialog"
          className="absolute left-[26%] top-[15.25%] z-10 flex h-[26%] w-[80%] rotate-[14deg] flex-col rounded-[28px] border border-white/70 bg-[#C8D1DE] p-6 text-left shadow-[0_12px_28px_-16px_rgba(70,64,45,0.12)] cursor-pointer md:top-[12.75%]"
        >
          <MobileTab
            className="-top-[26px] right-[12%] h-[108px] w-[72px] text-[#5A4440]"
            icon={<Headset className="h-9 w-9" strokeWidth={1.6} />}
            fill="#9BA9BE"
          />
          <span className={`${descClass} max-w-[62%]`}>
            获取报告深度解读
            <br />
            与一对一护理建议
          </span>
          <span className={`${titleClass} mt-3`}>专属顾问</span>
        </button>

        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="查看护肤档案"
          aria-haspopup="dialog"
          className="absolute left-[26%] top-[58.75%] z-10 flex h-[26%] w-[80%] -rotate-[14deg] flex-col justify-end rounded-[28px] border border-white/70 bg-[#D4C5B3] p-6 text-left shadow-[0_14px_32px_-18px_rgba(70,64,45,0.13)] cursor-pointer md:top-[61.25%]"
        >
          <MobileTab
            className="-top-[24px] right-[12%] h-[104px] w-[70px] text-[#4C3A33]"
            icon={<NotebookPen className="h-9 w-9" strokeWidth={1.55} />}
            fill="#A49082"
          />
          <span className={`${profileDescClass} max-w-[62%]`}>
            完成每日打卡
            <br />
            查看肌肤变化
          </span>
          <span className={`${titleClass} mt-3`}>护肤档案</span>
        </button>

        <div
          className="absolute left-[14%] top-[35%] z-20 flex h-[30%] w-[86%] flex-col justify-between rounded-[28px] border border-white/70 bg-[#F4E9D7] p-5 text-left shadow-[0_16px_36px_-18px_rgba(70,64,45,0.16)] max-md:rounded-r-none max-md:pr-10"
          style={phoneBleed > 0 ? { width: `calc(86% + ${phoneBleed}px)` } : undefined}
        >
          <MobileTab
            className="-top-[28px] right-[10%] h-[112px] w-[76px] text-[#6B4A33]"
            icon={<ScanFace className="h-10 w-10" strokeWidth={1.55} />}
            fill="#E5C8B5"
          />
          <Image
            src="/images/jzp-eyebrow.png"
            alt="肌智派"
            width={256}
            height={156}
            className="mt-2 h-14 w-auto self-start object-contain"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#CCAB9E] px-2 py-1 text-[10px] tracking-[0.02em] text-[#5A423C]">
              # 派系鉴定
            </span>
            <span className="rounded-md bg-[#CCAB9E] px-2 py-1 text-[10px] tracking-[0.02em] text-[#5A423C]">
              # 专属测肤报告
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[30px] font-semibold leading-[1.12] tracking-[0.06em] text-[#1c1c1c]">
              在线测肤
            </span>
            <button
              type="button"
              onClick={onStartTest}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#00263E] px-4 py-2.5 text-[13px] font-medium tracking-[0.02em] text-white transition-transform active:scale-[0.97] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E4D9E]/50 focus-visible:ring-offset-2 cursor-pointer"
            >
              立即开始
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
