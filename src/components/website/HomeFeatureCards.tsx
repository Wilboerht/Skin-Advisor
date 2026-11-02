"use client";

import type { CSSProperties } from "react";
import { Headset, NotebookPen, ScanFace } from "lucide-react";

interface HomeFeatureCardsProps {
  onStartTest: () => void;
  onOpenProfile: () => void;
  onOpenAdvisor: () => void;
}

const cardBaseClass =
  "hero-card group absolute flex flex-col rounded-[26px] border border-white/70 text-left text-[#172B43] shadow-[0_28px_60px_-28px_rgba(0,38,62,0.36)] cursor-pointer sm:rounded-[32px] sm:px-9 sm:pt-8 sm:pb-7 pc:rounded-[6.78cqh] pc:px-[8.814cqh] pc:pt-[6.78cqh] pc:pb-[5.424cqh]";

const cardStyle = (rotate: string) => ({ "--card-rotate": rotate } as CSSProperties);

const ribbonClass =
  "absolute flex items-center justify-center";
const ribbonInnerClass = "relative z-10 h-9 w-9 -translate-y-[2px] sm:h-10 sm:w-10 sm:-translate-y-[5px] pc:h-[8.814cqh] pc:w-[8.814cqh] pc:-translate-y-[2.542cqh]";

export function BookmarkShape({ fill = "#E5C8B5" }: { fill?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 142 195"
      fill="none"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ filter: "drop-shadow(0 6px 14px rgba(70, 64, 45, 0.12))" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M141.745 194.474L70.8724 151.257L0 194.474V21.6082C0 15.8773 2.1334 10.3812 5.93087 6.32889C9.72834 2.27657 14.8788 0 20.2493 0H121.496C126.866 0 132.016 2.27657 135.814 6.32889C139.611 10.3812 141.745 15.8773 141.745 21.6082V194.474Z"
        fill={fill}
      />
    </svg>
  );
}

export function HomeFeatureCards({ onStartTest, onOpenProfile, onOpenAdvisor }: HomeFeatureCardsProps) {
  return (
    <div
      className="hero-card-fan relative isolate mx-auto h-[350px] w-full max-w-[380px] shrink-0 select-none sm:h-[410px] sm:max-w-[460px] pc:mx-0 pc:max-w-none"
      aria-label="肌智派服务入口"
    >
      <div aria-hidden="true" className="absolute left-[15%] top-[8%] h-[78%] w-[70%] rounded-full bg-[#DDE3EA]/55 blur-3xl" />

      <button
        type="button"
        onClick={onOpenAdvisor}
        aria-label="联系专属顾问"
        aria-haspopup="dialog"
        style={cardStyle("-27deg")}
        className={`${cardBaseClass} left-0 top-[18%] z-10 h-[80%] w-[46%] justify-start bg-[#C8D1DE] px-7 pt-6 pb-5 pc:left-[14%] pc:top-[20%]`}
      >
        <span
          aria-hidden="true"
          className={`${ribbonClass} -top-[13px] right-[9%] h-[58px] w-[50px] text-[#5A4440] sm:-top-[16px] sm:h-[70px] sm:w-[58px] pc:-top-[8.475cqh] pc:h-[25.424cqh] pc:w-[20cqh]`}
        >
          <BookmarkShape fill="#9BA9BE" />
          <Headset className={ribbonInnerClass} strokeWidth={1.6} />
        </span>
        <span className="block">
          <span className="block text-[27px] font-semibold leading-[1.12] tracking-[0.06em] text-[#1c1c1c] sm:text-[29px] pc:text-[5.763cqh]">专属顾问</span>
          <span className="mt-1 block text-[14px] font-light tracking-[0.02em] text-[#172B43]/55 sm:text-[15px] pc:text-[3.22cqh]">Personal Advisor</span>
        </span>
      </button>

      <button
        type="button"
        onClick={onStartTest}
        aria-label="开始在线测肤"
        style={cardStyle("-11deg")}
        className={`${cardBaseClass} hero-card-center left-[27%] top-0 z-20 h-[80%] w-[46%] bg-[#F4E9D7] px-7 pt-6 pb-5 pc:left-[31%]`}
      >
        <span
          aria-hidden="true"
          className={`${ribbonClass} -top-[13px] right-[9%] h-[64px] w-[54px] text-[#6B4A33] sm:-top-[16px] sm:h-[76px] sm:w-[62px] pc:-top-[8.475cqh] pc:h-[28.814cqh] pc:w-[22.373cqh]`}
        >
          <BookmarkShape fill="#E5C8B5" />
          <ScanFace className={ribbonInnerClass} strokeWidth={1.55} />
        </span>
        <span className="block pt-14 sm:pt-16 pc:pt-0">
          <span className="block text-[27px] font-semibold leading-[1.12] tracking-[0.06em] text-[#1c1c1c] sm:text-[29px] pc:text-[5.763cqh]">在线测肤</span>
          <span className="mt-1 block text-[14px] font-light tracking-[0.02em] text-[#172B43]/55 sm:text-[15px] pc:text-[3.22cqh]">Skin Test</span>
        </span>
        <span className="mt-5 block text-[14px] leading-[1.8] text-[#172B43]/65 sm:mt-7 sm:text-[15px] pc:mt-[4.407cqh] pc:text-[3.051cqh]">
          <span className="block">AI 面部分析</span>
          <span className="block">生成专属肌肤报告</span>
        </span>
        <span className="mt-auto block pc:mb-[17.627cqh]">
          <span className="mb-3 flex items-center gap-2 pc:mb-[2.712cqh]">
            <span className="rounded-md bg-[#CCAB9E] px-2.5 py-1.5 text-[11px] tracking-[0.04em] text-[#5A423C] sm:text-[12px] pc:rounded-[1.356cqh] pc:px-[2.034cqh] pc:py-[1.356cqh] pc:text-[2.542cqh]"># 派系鉴定</span>
            <span aria-hidden="true" className="h-6 w-6 rounded-md bg-[#E5C8B5] pc:h-[5.424cqh] pc:w-[5.424cqh] pc:rounded-[1.356cqh]" />
          </span>
          <span aria-hidden="true" className="hidden space-y-2.5 sm:space-y-3 pc:block pc:space-y-[1.695cqh]">
            <span className="block h-7 w-full rounded-md bg-[#EADCC6] pc:h-[5.424cqh] pc:rounded-[1.356cqh]" />
            <span className="block h-7 w-[62%] rounded-md bg-[#EADCC6] pc:h-[5.424cqh] pc:rounded-[1.356cqh]" />
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenProfile}
        aria-label="查看护肤档案"
        aria-haspopup="dialog"
        style={cardStyle("5deg")}
        className={`${cardBaseClass} left-[54%] top-[12%] z-30 h-[80%] w-[46%] bg-[#D4C5B3] px-7 pt-6 pb-5 pc:left-[53%] pc:top-[8%]`}
      >
        <span
          aria-hidden="true"
          className={`${ribbonClass} -top-[13px] right-[9%] h-[58px] w-[50px] text-[#4C3A33] sm:-top-[16px] sm:h-[70px] sm:w-[58px] pc:-top-[8.475cqh] pc:h-[25.424cqh] pc:w-[20cqh]`}
        >
          <BookmarkShape fill="#A49082" />
          <NotebookPen className={ribbonInnerClass} strokeWidth={1.55} />
        </span>
        <span className="block pt-14 sm:pt-16 pc:pt-0">
          <span className="block text-[27px] font-semibold leading-[1.12] tracking-[0.06em] text-[#1c1c1c] sm:text-[29px] pc:text-[5.763cqh]">护肤档案</span>
          <span className="mt-1 block whitespace-nowrap text-[14px] font-light tracking-[0.02em] text-[#93A1B3] sm:text-[15px] pc:text-[3.22cqh]">Skincare Profile</span>
        </span>
        <span className="mt-6 block text-[14px] leading-[1.8] text-[#6C5D53] sm:mt-8 sm:text-[15px] pc:mt-[5.424cqh] pc:text-[2.881cqh]">
          <span className="block">完成每日打卡</span>
          <span className="block">查看肌肤变化</span>
        </span>
      </button>
    </div>
  );
}
