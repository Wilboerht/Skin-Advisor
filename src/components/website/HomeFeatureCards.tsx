"use client";

import { ArrowUpRight, MessageCircleHeart, NotebookPen, ScanFace } from "lucide-react";

interface HomeFeatureCardsProps {
  onStartTest: () => void;
  onOpenProfile: () => void;
  onOpenAdvisor: () => void;
}

const cardFocusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E4D9E]/60 focus-visible:ring-offset-4 focus-visible:ring-offset-[#F3F1EB]";

export function HomeFeatureCards({ onStartTest, onOpenProfile, onOpenAdvisor }: HomeFeatureCardsProps) {
  return (
    <div className="relative mx-auto h-[350px] w-full max-w-[380px] select-none sm:h-[410px] sm:max-w-[460px] pc:h-[590px] pc:max-w-[680px]" aria-label="肌智派服务入口">
      <div aria-hidden="true" className="absolute left-[15%] top-[8%] h-[78%] w-[70%] rounded-full bg-[#DDE3EA]/55 blur-3xl" />

      <button
        type="button"
        onClick={onOpenAdvisor}
        aria-label="联系专属顾问"
        aria-haspopup="dialog"
        className={`${cardFocusClass} group absolute bottom-[1%] left-[1%] z-10 flex h-[39%] w-[45%] -rotate-[18deg] flex-col justify-between overflow-hidden rounded-[24px] border border-white/50 bg-[#BCC8D5] p-5 text-left text-[#172B43] shadow-[0_22px_45px_-24px_rgba(0,38,62,0.45)] transition-[transform,box-shadow] duration-300 hover:-translate-y-2 hover:shadow-[0_28px_50px_-22px_rgba(0,38,62,0.5)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:rounded-[30px] sm:p-6 pc:bottom-[2%] pc:left-[2%] pc:h-[40%] pc:w-[43%] pc:rounded-[36px] pc:p-8 cursor-pointer`}
      >
        <span className="flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/35 pc:h-12 pc:w-12">
            <MessageCircleHeart className="h-5 w-5 pc:h-6 pc:w-6" strokeWidth={1.6} />
          </span>
          <ArrowUpRight className="h-5 w-5 opacity-45 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
        <span>
          <span className="block text-[22px] font-semibold tracking-[0.04em] pc:text-[32px]">专属顾问</span>
          <span className="mt-1 block text-[11px] tracking-[0.02em] text-[#172B43]/55 pc:text-[15px]">Personal Advisor</span>
        </span>
      </button>

      <button
        type="button"
        onClick={onStartTest}
        aria-label="开始在线测肤"
        className={`${cardFocusClass} group absolute left-[15%] top-[3%] z-20 flex h-[79%] w-[51%] -rotate-[11deg] flex-col overflow-hidden rounded-[26px] border border-white/80 bg-white p-5 text-left text-[#172B43] shadow-[0_28px_60px_-28px_rgba(0,38,62,0.38)] transition-[transform,box-shadow] duration-300 hover:-translate-y-2 hover:shadow-[0_34px_65px_-26px_rgba(0,38,62,0.42)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:rounded-[32px] sm:p-7 pc:left-[17%] pc:top-[3%] pc:h-[82%] pc:w-[49%] pc:rounded-[40px] pc:p-9 cursor-pointer`}
      >
        <span aria-hidden="true" className="absolute -top-1 right-5 flex h-[70px] w-[58px] items-start justify-center rounded-b-[18px] bg-[#E7ECF2] pt-5 text-[#2E4D9E] shadow-sm sm:right-7 sm:h-[82px] sm:w-[68px] pc:h-[104px] pc:w-[82px] pc:rounded-b-[24px] pc:pt-7">
          <ScanFace className="h-7 w-7 sm:h-8 sm:w-8 pc:h-10 pc:w-10" strokeWidth={1.55} />
        </span>
        <span className="block pt-12 sm:pt-14 pc:pt-20">
          <span className="block text-[25px] font-semibold tracking-[0.02em] sm:text-[28px] pc:text-[38px]">在线测肤</span>
          <span className="mt-1 block text-[13px] font-light tracking-[0.04em] text-[#172B43]/45 pc:text-[19px]">Skin Test</span>
        </span>
        <span className="mt-5 block text-[12px] leading-[1.8] text-[#172B43]/65 sm:mt-7 sm:text-[13px] pc:mt-10 pc:text-[16px]">
          <span className="block">AI 面部分析</span>
          <span className="block">生成专属肌肤报告</span>
        </span>
        <span className="mt-auto block">
          <span className="mb-3 flex items-center gap-2 pc:mb-5">
            <span className="rounded-md bg-[#2E4D9E] px-2.5 py-1.5 text-[10px] tracking-[0.04em] text-white pc:rounded-lg pc:px-3 pc:py-2 pc:text-[13px]"># 派系鉴定</span>
            <span aria-hidden="true" className="h-6 w-6 rounded-md bg-[#D8DFE8] pc:h-8 pc:w-8 pc:rounded-lg" />
          </span>
          <span aria-hidden="true" className="block h-7 w-[78%] rounded-md bg-[#F0F2F4] pc:h-10 pc:rounded-lg" />
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenProfile}
        aria-label="查看护肤档案"
        aria-haspopup="dialog"
        className={`${cardFocusClass} group absolute right-[1%] top-[14%] z-30 flex h-[70%] w-[45%] rotate-[8deg] flex-col overflow-hidden rounded-[26px] border border-white/70 bg-[#F8F7F3] p-5 text-left text-[#172B43] shadow-[0_28px_60px_-28px_rgba(0,38,62,0.34)] transition-[transform,box-shadow] duration-300 hover:-translate-y-2 hover:shadow-[0_34px_65px_-26px_rgba(0,38,62,0.4)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:rounded-[32px] sm:p-7 pc:right-[1%] pc:top-[16%] pc:h-[72%] pc:w-[43%] pc:rounded-[40px] pc:p-9 cursor-pointer`}
      >
        <span aria-hidden="true" className="absolute -top-1 right-4 flex h-[64px] w-[54px] items-start justify-center rounded-b-[17px] bg-[#DDE3EA] pt-5 text-[#172B43] shadow-sm sm:right-6 sm:h-[74px] sm:w-[62px] pc:h-[94px] pc:w-[76px] pc:rounded-b-[23px] pc:pt-7">
          <NotebookPen className="h-7 w-7 sm:h-8 sm:w-8 pc:h-10 pc:w-10" strokeWidth={1.55} />
        </span>
        <span className="block pt-12 sm:pt-14 pc:pt-20">
          <span className="block text-[23px] font-semibold tracking-[0.02em] sm:text-[27px] pc:text-[36px]">护肤档案</span>
          <span className="mt-1 block whitespace-nowrap text-[11px] font-light tracking-[0.01em] text-[#172B43]/45 sm:text-[13px] pc:text-[17px]">Skincare Profile</span>
        </span>
        <span className="mt-6 block text-[12px] leading-[1.8] text-[#172B43]/60 sm:mt-8 sm:text-[13px] pc:mt-12 pc:text-[16px]">
          <span className="block">完成每日打卡</span>
          <span className="block">查看肌肤变化</span>
        </span>
        <span className="mt-auto flex items-center justify-end text-[#172B43]/40">
          <ArrowUpRight className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none pc:h-6 pc:w-6" />
        </span>
      </button>
    </div>
  );
}
