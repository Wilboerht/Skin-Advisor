"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowRight, Headset, NotebookPen, ScanFace } from "lucide-react";

import { BookmarkShape } from "@/components/website/HomeFeatureCards";

interface HomeMobileHeroProps {
  onStartTest: () => void;
  onOpenProfile: () => void;
  onOpenAdvisor: () => void;
}

const titleClass =
  "block text-[30px] font-semibold leading-[1.12] tracking-[0.06em] text-[#1c1c1c]";
const descClass =
  "block text-[12px] leading-[1.75] tracking-[0.02em] text-[#172B43]/65";

function MobileTab({
  className,
  icon,
}: {
  className: string;
  icon: ReactNode;
}) {
  return (
    <span aria-hidden="true" className={`absolute flex items-center justify-center ${className}`}>
      <BookmarkShape />
      <span className="relative z-10 flex items-center justify-center">{icon}</span>
    </span>
  );
}

export function HomeMobileHero({ onStartTest, onOpenProfile, onOpenAdvisor }: HomeMobileHeroProps) {
  return (
    <div className="relative flex min-h-[660px] flex-1 overflow-hidden bg-[#F3F1EB] md:hidden">
      <h1 className="sr-only">觉醒你的肌肤派系</h1>
      <div className="relative mx-auto h-full w-full max-w-[430px] flex-1">
        <button
          type="button"
          onClick={onOpenAdvisor}
          aria-label="联系专属顾问"
          aria-haspopup="dialog"
          className="absolute left-[23%] top-[15.25%] z-10 flex h-[26%] w-[80%] rotate-[14deg] flex-col rounded-[28px] border border-white/60 bg-[#BCC8D5] p-6 text-left shadow-[0_24px_55px_-26px_rgba(0,38,62,0.42)] cursor-pointer"
        >
          <MobileTab
            className="-top-[26px] right-[7%] h-[108px] w-[72px] text-[#172B43]"
            icon={<Headset className="h-9 w-9" strokeWidth={1.6} />}
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
          className="absolute left-[23%] top-[58.75%] z-10 flex h-[26%] w-[80%] -rotate-[14deg] flex-col justify-end rounded-[28px] border border-white/70 bg-[#F8F7F3] p-6 text-left shadow-[0_24px_55px_-26px_rgba(0,38,62,0.34)] cursor-pointer"
        >
          <MobileTab
            className="-top-[24px] right-[7%] h-[104px] w-[70px] text-[#172B43]"
            icon={<NotebookPen className="h-9 w-9" strokeWidth={1.55} />}
          />
          <span className={`${descClass} max-w-[62%]`}>
            完成每日打卡
            <br />
            查看肌肤变化
          </span>
          <span className={`${titleClass} mt-3`}>护肤档案</span>
        </button>

        <div className="absolute left-[14%] top-[35%] z-20 flex h-[30%] w-[86%] flex-col justify-between rounded-[28px] bg-white p-5 text-left shadow-[0_30px_60px_-24px_rgba(0,38,62,0.32)]">
          <MobileTab
            className="-top-[28px] right-[10%] h-[112px] w-[76px] text-[#2E4D9E]"
            icon={<ScanFace className="h-10 w-10" strokeWidth={1.55} />}
          />
          <Image
            src="/images/jzp-eyebrow.png"
            alt="肌智派"
            width={256}
            height={156}
            className="mt-2 h-14 w-auto self-start object-contain"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#ECEAE4] px-2 py-1 text-[10px] tracking-[0.02em] text-[#5B5952]">
              # 派系鉴定
            </span>
            <span className="rounded-md bg-[#ECEAE4] px-2 py-1 text-[10px] tracking-[0.02em] text-[#5B5952]">
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
  );
}
