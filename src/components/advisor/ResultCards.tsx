'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { getTZoneLabel, getCharacterImage, getSkinTypeName, type IPMatchParams } from '@/lib/result-utils';


interface Dimension {
  score?: number;
  percentile?: number;
}

interface ResultCardsProps {
  score?: number;
  skinAge: number;
  dimensions: Record<string, Dimension | undefined>;
  nickname: string;
  gender?: string;
  skinType?: string;
  budget?: string;
  skincareFrequency?: string;
  summary?: string;
  rankPercentile?: number;
  onDownloadPoster: () => void;
  isPosterLoading?: boolean;
  professionalClassName?: string;
  professionalStyle?: React.CSSProperties;
  comprehensiveReport?: React.ReactNode;
}

const AnimatedNumber = ({ value, duration = 1.5 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = value / (duration * 1000 / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(Math.round(value));
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);

  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {displayValue}
    </motion.span>
  );
};

export default function ResultCards({
  score,
  skinAge,
  dimensions,
  nickname,
  gender = 'female',
  skinType = 'combination',
  budget,
  skincareFrequency,
  summary,
  rankPercentile,
  onDownloadPoster,
  isPosterLoading = false,
  professionalClassName,
  professionalStyle,
  comprehensiveReport,
}: ResultCardsProps) {
  const ipParams: IPMatchParams = { score: score ?? 0, skinType, budget, skincareFrequency };
  const characterImage = getCharacterImage({ ...ipParams, gender });
  const skinTypeName = getSkinTypeName(ipParams);

  const tZoneLabel = useMemo(
    () => getTZoneLabel(dimensions?.waterOil?.score ?? 0),
    [dimensions]
  );



  return (
    <div className="w-full flex flex-col gap-6">
      {/* Mobile: Character IP Image + Share Card (no gap between them) */}
      <div className="flex flex-col gap-0 lg:contents">
        {/* Mobile: Character IP Image above Share Card */}
        <div className="relative flex lg:hidden justify-center pointer-events-none mx-auto h-[270px] w-[270px]">
          {/* Mobile-only decorative background behind character */}
          <div className="absolute inset-0 z-0 translate-y-12">
            <Image
              src="/images/character-bg-mobile.png"
              alt=""
              fill
              className="object-contain brightness-125"
              priority
              aria-hidden="true"
            />
          </div>
          <Image
            src={characterImage}
            alt={skinTypeName}
            width={280}
            height={280}
            className="relative z-10 h-[270px] w-[270px] object-contain drop-shadow-[0_3px_8px_rgba(92,73,55,0.12)]"
            priority
            onError={(e) => {
              const fallback = characterImage.replace('_male', '_female');
              (e.target as HTMLImageElement).src = fallback;
            }}
          />
        </div>
        {/* Share Version Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative rounded-[20px] lg:rounded-[24px] p-6 lg:p-10 border border-[#3d2f25]/8 overflow-visible"
          style={{
          background: '#F5F2ED',
        }}
      >
        <div className="relative z-10 w-full pr-0 lg:pr-[330px]">
          {/* Text Content */}
          <div className="flex flex-col justify-center z-10">
            {/* 分享版标签 */}
            <div className="relative z-10 mb-4 lg:mb-6 inline-flex h-[24px] px-2 items-center justify-center rounded-full border border-[#00263e]/15 bg-transparent text-xs font-bold text-[#00263e] lg:h-[26px] lg:px-2.5 lg:text-xs lg:tracking-wide lg:rounded-lg lg:border lg:border-[#00263e]/30 whitespace-nowrap self-start">
              肌智派证书
            </div>

            <h2 className="text-lg lg:text-[24px] font-bold text-[#3d2f25] leading-snug tracking-tight mb-1 lg:mb-2">
              你的肌肤类型是「{skinTypeName}」
            </h2>

            {score === undefined ? (
              <h3 className="text-lg lg:text-[24px] font-bold text-[#3d2f25] leading-snug tracking-tight mb-3 lg:mb-4">
                基于问卷的肤质评估
              </h3>
            ) : rankPercentile !== undefined ? (
              <h3 className="text-lg lg:text-[24px] font-bold text-[#3d2f25] leading-snug tracking-tight mb-3 lg:mb-4">
                素颜评分超越了全国 <span className="text-lg lg:text-[24px] px-0.5 text-[#00263e]">{rankPercentile}%</span> 的用户
              </h3>
            ) : (
              <h3 className="text-lg lg:text-[24px] font-bold text-[#3d2f25] leading-snug tracking-tight mb-3 lg:mb-4">
                素颜评估已完成
              </h3>
            )}

            <p className="text-[14px] leading-relaxed text-[#5c4937] mb-5 lg:mb-6 max-w-full lg:max-w-[420px]">
              {summary || '整体状态极佳，肌肤屏障健康，水油平衡度完美。'}
            </p>

            {/* Download Poster Button */}
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={isPosterLoading ? {} : { scale: 1.02 }}
                whileTap={isPosterLoading ? {} : { scale: 0.98 }}
                onClick={onDownloadPoster}
                disabled={isPosterLoading}
                className="inline-flex items-center justify-center gap-2 h-[34px] sm:h-[40px] px-4 sm:px-6 rounded-full border border-[#8c7a6b]/40 bg-transparent text-[#5c4937] text-xs sm:text-[13px] font-medium transition-colors hover:bg-[#3d2f25]/5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPosterLoading ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8c7a6b] stroke-[2] animate-spin" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8c7a6b] stroke-[2]" />
                )}
                {isPosterLoading ? '生成中...' : '保存素颜证书'}
              </motion.button>
            </div>
          </div>

          {/* Desktop: Character IP Image (absolute right) */}
          <div className="hidden lg:block absolute right-0 top-[40%] -translate-y-1/2 z-0 pointer-events-none">
            <Image
              src={characterImage}
              alt={skinTypeName}
              width={320}
              height={320}
              className="w-[320px] h-[320px] object-contain object-right"
              priority
              onError={(e) => {
                const fallback = characterImage.replace('_male', '_female');
                (e.target as HTMLImageElement).src = fallback;
              }}
            />
          </div>
        </div>
      </motion.div>
      </div>

      {/* Professional Version Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`relative rounded-[32px] p-6 lg:p-10 border border-[#3d2f25]/8 overflow-hidden ${professionalClassName || ''}`}
        style={{
          background: '#F5F2ED',
          boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
          ...professionalStyle,
        }}
      >
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-0 lg:gap-12 h-full">
          <div className="flex flex-col justify-between items-start w-full lg:w-[30%] shrink-0">
            <div>
              <div className="relative z-10 mb-4 inline-flex h-[24px] px-2 items-center justify-center rounded-full border border-[#00263e]/15 bg-transparent text-xs font-bold text-[#00263e] lg:mb-6 lg:h-[26px] lg:px-2.5 lg:text-xs lg:tracking-wide lg:rounded-lg lg:border lg:border-[#00263e]/30 whitespace-nowrap">
                专业版报告
              </div>
              <h2 className="text-lg lg:text-2xl font-bold text-[#3d2f25] mb-2 relative z-10">
                深度肌肤检测报告
              </h2>
              <p className="text-[#5c4937] text-xs lg:text-xs max-w-xs leading-relaxed mb-4 lg:mb-8 font-medium tracking-wide relative z-10">
                基于千万级亚洲肌肤数据库，全方位解析您的肌肤问题。
              </p>
            </div>

          </div>

          {/* Cards Grid: 2x2 on mobile, 4-col on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 flex-1 w-full lg:max-w-none">
            {/* Comprehensive Score */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="p-3 lg:p-4 rounded-xl lg:rounded-2xl flex flex-row lg:flex-col items-center lg:items-start justify-between lg:aspect-[2/3] relative min-h-[48px] lg:min-h-0"
              style={{
                background: '#F0EDE8',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              <div className="flex flex-row lg:flex-col items-center lg:items-start gap-2 lg:justify-between w-full h-full relative z-20">
                <p className="text-xs lg:text-xs text-[#7a6552] font-medium shrink-0">综合评分</p>
                <div className="flex items-baseline">
                  <span className="text-xs lg:text-3xl font-bold text-[#00263e] lg:text-[#5c4937] leading-none">
                    {score === undefined ? '-' : <AnimatedNumber value={score} duration={1.5} />}
                  </span>
                  {score !== undefined && (
                    <span className="text-xs lg:text-xs text-[#7a6552] ml-0.5 font-medium">分</span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Skin Age */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 }}
              className="p-3 lg:p-4 rounded-xl lg:rounded-2xl flex flex-row lg:flex-col items-center lg:items-start justify-between lg:aspect-[2/3] min-h-[48px] lg:min-h-0 relative overflow-hidden"
              style={{
                background: '#EBE8E2',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              <div className="flex flex-row lg:flex-col items-center lg:items-start gap-2 lg:justify-between w-full h-full relative z-20">
                <p className="text-xs lg:text-xs text-[#7a6552] font-medium shrink-0">肌肤年龄</p>
                <div className="flex items-baseline">
                  <span className="text-xs lg:text-3xl font-bold text-[#00263e] lg:text-[#5c4937] leading-none">
                    <AnimatedNumber value={skinAge} duration={1.5} />
                  </span>
                  <span className="text-xs lg:text-xs text-[#7a6552] ml-0.5 font-medium">岁</span>
                </div>
              </div>
            </motion.div>

            {/* T-zone Indicator */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="p-3 lg:p-4 rounded-xl lg:rounded-2xl flex flex-row lg:flex-col items-center lg:items-start justify-between lg:aspect-[2/3] min-h-[48px] lg:min-h-0 relative overflow-hidden"
              style={{
                background: '#E6E2DA',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              <div className="flex flex-row lg:flex-col items-center lg:items-start gap-2 lg:justify-between w-full h-full relative z-20">
                <p className="text-xs lg:text-xs text-[#7a6552] font-medium shrink-0">油脂分泌</p>
                <div className="flex items-baseline">
                  <span className="text-xs lg:text-xl font-bold text-[#00263e] lg:text-[#5c4937] leading-tight">{tZoneLabel}</span>
                </div>
              </div>
            </motion.div>

            {/* Last slot: 皮肤弹性（取 firmness 维度，问卷模式无数据时显示 -） */}
            <div
              className="flex p-3 lg:p-4 rounded-xl lg:rounded-2xl flex-row lg:flex-col items-center lg:items-start justify-between lg:aspect-[2/3] min-h-[48px] lg:min-h-0 relative overflow-hidden"
              style={{
                background: '#DDD8CE',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              <div className="flex flex-row lg:flex-col items-center lg:items-start gap-2 lg:justify-between w-full h-full relative z-20">
                <p className="text-xs lg:text-xs text-[#7a6552] font-medium shrink-0">皮肤弹性</p>
                <div className="flex items-baseline">
                  <span className="text-xs lg:text-3xl font-bold text-[#00263e] lg:text-[#5c4937] leading-none">
                    {dimensions?.firmness?.score === undefined ? '-' : <AnimatedNumber value={dimensions.firmness.score} duration={1.5} />}
                  </span>
                  {dimensions?.firmness?.score !== undefined && (
                    <span className="text-xs lg:text-xs text-[#7a6552] ml-0.5 font-medium">分</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {comprehensiveReport}
      </motion.div>

    </div>
  );
}
