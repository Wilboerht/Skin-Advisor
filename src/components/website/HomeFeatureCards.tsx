"use client";

import type { CSSProperties } from "react";
import { Headset, NotebookPen, ScanFace } from "lucide-react";

interface HomeFeatureCardsProps {
  onStartTest: () => void;
  onOpenProfile: () => void;
  onOpenAdvisor: () => void;
}

const cardBaseClass =
  "hero-card group absolute flex flex-col rounded-[26px] border border-white/70 text-[#172B43] shadow-[0_28px_60px_-28px_rgba(0,38,62,0.36)] cursor-pointer sm:rounded-[32px] sm:p-7 pc:rounded-[40px] pc:p-[clamp(20px,3.4vh,32px)]";

const cardStyle = (rotate: string) => ({ "--card-rotate": rotate } as CSSProperties);

const ribbonClass =
  "absolute flex items-center justify-center rounded-[24px] shadow-[0_12px_28px_-16px_rgba(0,38,62,0.35)]";
const ribbonInnerClass = "h-8 w-8 sm:h-9 sm:w-9 pc:h-[clamp(30px,4.6vh,46px)] pc:w-[clamp(30px,4.6vh,46px)]";

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
        className={`${cardBaseClass} left-0 top-[18%] z-10 h-[80%] w-[46%] justify-between bg-[#BCC8D5] p-5 pc:left-[9%] pc:top-[20%]`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/35 sm:h-11 sm:w-11 pc:h-[clamp(36px,5vh,46px)] pc:w-[clamp(36px,5vh,46px)]">
          <Headset className="h-5 w-5 pc:h-[clamp(18px,2.6vh,24px)] pc:w-[clamp(18px,2.6vh,24px)]" strokeWidth={1.6} />
        </span>
        <span className="pb-[clamp(24px,4vh,40px)] sm:pb-[clamp(28px,5vh,52px)] pc:pb-[clamp(80px,16vh,168px)]">
          <span className="block text-[22px] font-semibold tracking-[0.02em] sm:text-[24px] pc:text-[clamp(24px,3.2vh,28px)]">专属顾问</span>
          <span className="mt-1 block text-[11px] font-light tracking-[0.02em] text-[#172B43]/55 sm:text-[12px] pc:text-[clamp(12px,1.7vh,14px)]">Personal Advisor</span>
        </span>
      </button>

      <button
        type="button"
        onClick={onStartTest}
        aria-label="开始在线测肤"
        style={cardStyle("-11deg")}
        className={`${cardBaseClass} hero-card-center left-[27%] top-0 z-20 h-[80%] w-[46%] bg-white p-5 pc:left-[31%]`}
      >
        <span
          aria-hidden="true"
          className={`${ribbonClass} -top-[28px] left-[60%] h-[64px] w-[54px] -translate-x-1/2 bg-[#E7ECF2] text-[#2E4D9E] sm:-top-[32px] sm:h-[76px] sm:w-[62px] pc:-top-[clamp(52px,8vh,84px)] pc:h-[clamp(110px,16vh,170px)] pc:w-[clamp(86px,12.5vh,132px)]`}
        >
          <ScanFace className={ribbonInnerClass} strokeWidth={1.55} />
        </span>
        <span className="block pt-14 sm:pt-16 pc:pt-[clamp(64px,10vh,96px)]">
          <span className="block text-[25px] font-semibold tracking-[0.02em] sm:text-[28px] pc:text-[clamp(33px,4.4vh,38px)]">在线测肤</span>
          <span className="mt-1 block text-[13px] font-light tracking-[0.02em] text-[#172B43]/45 sm:text-[15px] pc:text-[clamp(15px,2.1vh,19px)]">Skin Test</span>
        </span>
        <span className="mt-4 flex items-center gap-2 pc:mt-[clamp(12px,2.2vh,20px)]">
          <span className="rounded-md bg-[#2E4D9E] px-2.5 py-1.5 text-[10px] tracking-[0.04em] text-white pc:rounded-lg pc:px-3 pc:py-2 pc:text-[clamp(11px,1.4vh,13px)]"># 派系鉴定</span>
          <span aria-hidden="true" className="h-6 w-6 rounded-md bg-[#D8DFE8] pc:h-[clamp(24px,3.4vh,32px)] pc:w-[clamp(24px,3.4vh,32px)] pc:rounded-lg" />
        </span>
        <span className="mt-5 block text-[12px] leading-[1.8] text-[#172B43]/65 sm:mt-7 sm:text-[13px] pc:mt-[clamp(16px,2.8vh,26px)] pc:text-[clamp(14px,1.8vh,16px)]">
          <span className="block">AI 面部分析</span>
          <span className="block">生成专属肌肤报告</span>
        </span>
        <span aria-hidden="true" className="mt-auto hidden space-y-2.5 pt-5 sm:space-y-3 pc:block pc:space-y-[clamp(6px,1vh,10px)]">
          <span className="block h-7 w-full rounded-md bg-[#F0F2F4] pc:h-[clamp(22px,3.2vh,32px)] pc:rounded-lg" />
          <span className="block h-7 w-[62%] rounded-md bg-[#F0F2F4] pc:h-[clamp(22px,3.2vh,32px)] pc:rounded-lg" />
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenProfile}
        aria-label="查看护肤档案"
        aria-haspopup="dialog"
        style={cardStyle("5deg")}
        className={`${cardBaseClass} left-[54%] top-[12%] z-30 h-[80%] w-[46%] bg-[#F8F7F3] p-5 pc:left-[53%] pc:top-[8%]`}
      >
        <span
          aria-hidden="true"
          className={`${ribbonClass} -top-[24px] left-[74%] h-[58px] w-[50px] -translate-x-1/2 bg-[#DDE3EA] text-[#172B43] sm:-top-[28px] sm:h-[70px] sm:w-[58px] pc:-top-[clamp(48px,7vh,74px)] pc:h-[clamp(100px,14vh,150px)] pc:w-[clamp(78px,11vh,118px)]`}
        >
          <NotebookPen className={ribbonInnerClass} strokeWidth={1.55} />
        </span>
        <span className="block pt-14 sm:pt-16 pc:pt-[clamp(60px,9.5vh,86px)]">
          <span className="block text-[23px] font-semibold tracking-[0.02em] sm:text-[27px] pc:text-[clamp(29px,4vh,34px)]">护肤档案</span>
          <span className="mt-1 block whitespace-nowrap text-[11px] font-light tracking-[0.02em] text-[#172B43]/45 sm:text-[13px] pc:text-[clamp(14px,2vh,17px)]">Skincare Profile</span>
        </span>
        <span className="mt-6 block text-[12px] leading-[1.8] text-[#172B43]/60 sm:mt-8 sm:text-[13px] pc:mt-[clamp(20px,3.4vh,32px)] pc:text-[clamp(13px,1.7vh,15px)]">
          <span className="block">完成每日打卡</span>
          <span className="block">查看肌肤变化</span>
        </span>
      </button>
    </div>
  );
}
