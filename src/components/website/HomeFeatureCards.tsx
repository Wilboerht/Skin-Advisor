"use client";

import type { CSSProperties } from "react";
import { Headset, NotebookPen, ScanFace } from "lucide-react";

interface HomeFeatureCardsProps {
  onStartTest: () => void;
  onOpenProfile: () => void;
  onOpenAdvisor: () => void;
}

const cardBaseClass =
  "hero-card group absolute flex flex-col rounded-[26px] border border-white/70 text-left text-[#172B43] shadow-[0_28px_60px_-28px_rgba(0,38,62,0.36)] cursor-pointer sm:rounded-[32px] sm:px-9 sm:pt-8 sm:pb-7 pc:rounded-[40px] pc:px-[clamp(32px,4.8vh,52px)] pc:pt-[clamp(26px,4vh,40px)] pc:pb-[clamp(20px,3.4vh,32px)]";

const cardStyle = (rotate: string) => ({ "--card-rotate": rotate } as CSSProperties);

const ribbonClass =
  "absolute flex items-center justify-center";
const ribbonInnerClass = "relative z-10 h-9 w-9 -translate-y-[2px] sm:h-10 sm:w-10 sm:-translate-y-[5px] pc:h-[clamp(34px,5.2vh,52px)] pc:w-[clamp(34px,5.2vh,52px)] pc:-translate-y-[15px]";

function BookmarkShape() {
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
        fill="#E5C8B5"
      />
    </svg>
  );
}

export function HomeFeatureCards({ onStartTest, onOpenProfile, onOpenAdvisor }: HomeFeatureCardsProps) {
  return (
    <div
      className="hero-card-fan relative isolate mx-auto h-[350px] w-full max-w-[380px] select-none sm:h-[410px] sm:max-w-[460px] pc:mx-0 pc:max-w-none"
      aria-label="肌智派服务入口"
    >
      <div aria-hidden="true" className="absolute left-[15%] top-[8%] h-[78%] w-[70%] rounded-full bg-[#DDE3EA]/55 blur-3xl" />

      <button
        type="button"
        onClick={onOpenAdvisor}
        aria-label="联系专属顾问"
        aria-haspopup="dialog"
        style={cardStyle("-27deg")}
        className={`${cardBaseClass} left-0 top-[18%] z-10 h-[80%] w-[46%] justify-start bg-[#BCC8D5] px-7 pt-6 pb-5 pc:left-[9%] pc:top-[20%]`}
      >
        <span
          aria-hidden="true"
          className={`${ribbonClass} -top-[13px] right-[9%] h-[58px] w-[50px] text-[#172B43] sm:-top-[16px] sm:h-[70px] sm:w-[58px] pc:-top-[clamp(28px,4.7vh,50px)] pc:h-[clamp(100px,14vh,150px)] pc:w-[clamp(78px,11vh,118px)]`}
        >
          <BookmarkShape />
          <Headset className={ribbonInnerClass} strokeWidth={1.6} />
        </span>
        <span className="block">
          <span className="block text-[24px] font-semibold leading-[1.12] tracking-[0.06em] text-[#1c1c1c] sm:text-[26px] pc:text-[clamp(26px,3.4vh,30px)]">专属顾问</span>
          <span className="mt-1 block text-[12px] font-light tracking-[0.02em] text-[#172B43]/55 sm:text-[13px] pc:text-[clamp(14px,1.9vh,16px)]">Personal Advisor</span>
        </span>
      </button>

      <button
        type="button"
        onClick={onStartTest}
        aria-label="开始在线测肤"
        style={cardStyle("-11deg")}
        className={`${cardBaseClass} hero-card-center left-[27%] top-0 z-20 h-[80%] w-[46%] bg-white px-7 pt-6 pb-5 pc:left-[31%]`}
      >
        <span
          aria-hidden="true"
          className={`${ribbonClass} -top-[13px] right-[9%] h-[64px] w-[54px] text-[#2E4D9E] sm:-top-[16px] sm:h-[76px] sm:w-[62px] pc:-top-[clamp(28px,4.7vh,50px)] pc:h-[clamp(110px,16vh,170px)] pc:w-[clamp(86px,12.5vh,132px)]`}
        >
          <BookmarkShape />
          <ScanFace className={ribbonInnerClass} strokeWidth={1.55} />
        </span>
        <span className="block pt-14 sm:pt-16 pc:pt-0">
          <span className="block text-[24px] font-semibold leading-[1.12] tracking-[0.06em] text-[#1c1c1c] sm:text-[26px] pc:text-[clamp(26px,3.4vh,30px)]">在线测肤</span>
          <span className="mt-1 block text-[12px] font-light tracking-[0.02em] text-[#172B43]/55 sm:text-[13px] pc:text-[clamp(14px,1.9vh,16px)]">Skin Test</span>
        </span>
        <span className="mt-5 block text-[12px] leading-[1.8] text-[#172B43]/65 sm:mt-7 sm:text-[13px] pc:mt-[clamp(16px,2.8vh,26px)] pc:text-[clamp(14px,1.8vh,16px)]">
          <span className="block">AI 面部分析</span>
          <span className="block">生成专属肌肤报告</span>
        </span>
        <span className="mt-auto block pc:mb-[clamp(72px,9.6vh,104px)]">
          <span className="mb-3 flex items-center gap-2 pc:mb-[clamp(10px,1.8vh,16px)]">
            <span className="rounded-md bg-[#2E4D9E] px-2.5 py-1.5 text-[10px] tracking-[0.04em] text-white pc:rounded-lg pc:px-3 pc:py-2 pc:text-[clamp(11px,1.4vh,13px)]"># 派系鉴定</span>
            <span aria-hidden="true" className="h-6 w-6 rounded-md bg-[#D8DFE8] pc:h-[clamp(24px,3.4vh,32px)] pc:w-[clamp(24px,3.4vh,32px)] pc:rounded-lg" />
          </span>
          <span aria-hidden="true" className="hidden space-y-2.5 sm:space-y-3 pc:block pc:space-y-[clamp(6px,1vh,10px)]">
            <span className="block h-7 w-full rounded-md bg-[#F0F2F4] pc:h-[clamp(22px,3.2vh,32px)] pc:rounded-lg" />
            <span className="block h-7 w-[62%] rounded-md bg-[#F0F2F4] pc:h-[clamp(22px,3.2vh,32px)] pc:rounded-lg" />
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenProfile}
        aria-label="查看护肤档案"
        aria-haspopup="dialog"
        style={cardStyle("5deg")}
        className={`${cardBaseClass} left-[54%] top-[12%] z-30 h-[80%] w-[46%] bg-[#F8F7F3] px-7 pt-6 pb-5 pc:left-[53%] pc:top-[8%]`}
      >
        <span
          aria-hidden="true"
          className={`${ribbonClass} -top-[13px] right-[9%] h-[58px] w-[50px] text-[#172B43] sm:-top-[16px] sm:h-[70px] sm:w-[58px] pc:-top-[clamp(28px,4.7vh,50px)] pc:h-[clamp(100px,14vh,150px)] pc:w-[clamp(78px,11vh,118px)]`}
        >
          <BookmarkShape />
          <NotebookPen className={ribbonInnerClass} strokeWidth={1.55} />
        </span>
        <span className="block pt-14 sm:pt-16 pc:pt-0">
          <span className="block text-[24px] font-semibold leading-[1.12] tracking-[0.06em] text-[#1c1c1c] sm:text-[26px] pc:text-[clamp(26px,3.4vh,30px)]">护肤档案</span>
          <span className="mt-1 block whitespace-nowrap text-[12px] font-light tracking-[0.02em] text-[#172B43]/55 sm:text-[13px] pc:text-[clamp(14px,1.9vh,16px)]">Skincare Profile</span>
        </span>
        <span className="mt-6 block text-[12px] leading-[1.8] text-[#172B43]/60 sm:mt-8 sm:text-[13px] pc:mt-[clamp(20px,3.4vh,32px)] pc:text-[clamp(13px,1.7vh,15px)]">
          <span className="block">完成每日打卡</span>
          <span className="block">查看肌肤变化</span>
        </span>
      </button>
    </div>
  );
}
