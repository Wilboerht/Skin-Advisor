'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share2 } from 'lucide-react';
import Image from 'next/image';
import { getRankPercentile, getTZoneLabel, getCharacterImage, getSkinTypeName } from '@/lib/result-utils';


interface Dimension {
  score?: number;
  percentile?: number;
}

interface ResultCardsProps {
  score: number;
  skinAge: number;
  dimensions: Record<string, Dimension | undefined>;
  nickname: string;
  gender?: string;
  summary?: string;
  onShare: () => void;
  onUnlockClick?: () => void;
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
  summary,
  onShare,
  onUnlockClick,
  professionalClassName,
  professionalStyle,
  comprehensiveReport,
}: ResultCardsProps) {
  const characterImage = getCharacterImage(score, gender);
  const skinTypeName = getSkinTypeName(score);

  // 基于综合评分计算全国排名百分比
  const rankPercentile = useMemo(
    () => getRankPercentile(typeof score === 'number' ? score : 75),
    [score]
  );

  const tZoneLabel = useMemo(
    () => getTZoneLabel(dimensions?.waterOil?.score ?? 0),
    [dimensions]
  );



  return (
    <div className="w-full flex flex-col gap-6">
      {/* Share Version Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-[20px] lg:rounded-[24px] p-6 lg:p-8 border border-[#3d2f25]/8 overflow-visible"
        style={{
          background: '#F5F2ED',
        }}
      >
        <div className="relative z-10 w-full pr-[165px] sm:pr-[230px] lg:pr-[330px]">
          {/* Left: Text Content */}
          <div className="flex flex-col justify-center z-10">
            {/* Greeting */}
            <p className="text-[#a89582] text-xs lg:text-sm leading-none mb-3 lg:mb-4">
              亲爱的 <span className="text-[#8c7a6b]">{nickname}</span>
            </p>

            <h2 className="text-[24px] font-bold text-[#3d2f25] leading-snug tracking-tight mb-1 lg:mb-2">
              你的肌肤类型是「{skinTypeName}」
            </h2>

            <h3 className="text-[24px] font-bold text-[#3d2f25] leading-snug tracking-tight mb-3 lg:mb-4">
              素颜评分超越了全国 <span className="text-[24px] px-0.5 text-[#00263e]">{rankPercentile}%</span> 的用户
            </h3>

            <p className="text-[#8c7a6b] text-xs lg:text-sm leading-relaxed mb-5 lg:mb-6 max-w-[95%] lg:max-w-[420px]">
              {summary || '整体状态极佳，肌肤屏障健康，水油平衡度完美，仅在眼周区域存在轻微色素沉积。'}
            </p>

            {/* Share Button */}
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onShare}
                className="inline-flex items-center justify-center gap-2 h-[34px] sm:h-[40px] px-4 sm:px-6 rounded-full border border-[#8c7a6b]/40 bg-transparent text-[#5c4937] text-xs sm:text-[13px] font-medium transition-colors hover:bg-[#3d2f25]/5"
              >
                <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8c7a6b] stroke-[2]" />
                分享我的素颜证书
              </motion.button>
            </div>
          </div>

          {/* Right: Character IP Image */}
          <div className="absolute right-0 top-[40%] -translate-y-1/2 z-0 pointer-events-none">
            <Image
              src={characterImage}
              alt={skinTypeName}
              width={320}
              height={320}
              className="w-[160px] h-[160px] sm:w-[220px] sm:h-[220px] lg:w-[320px] lg:h-[320px] object-contain"
              priority
              onError={(e) => {
                // 男性图片缺失时降级为女性图片
                const fallback = characterImage.replace('_male', '_female');
                (e.target as HTMLImageElement).src = fallback;
              }}
            />
          </div>
        </div>
      </motion.div>

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
        <div className="flex flex-row lg:flex-row justify-between items-stretch lg:items-center gap-4 lg:gap-12 h-full">
          <div className="flex flex-col justify-between items-start w-[52%] lg:w-[30%] shrink-0">
            <div>
              <div className="bg-white/70 text-[#5c4937] w-[72px] lg:w-[72px] h-[24px] lg:h-[24px] rounded-lg text-xs lg:text-xs font-bold flex items-center justify-center mb-6 lg:mb-6 shadow-sm border border-[#3d2f25]/8 tracking-widest relative z-10">
                专业版
              </div>
              <h2 className="text-xl lg:text-2xl font-bold text-[#3d2f25] mb-2 relative z-10">
                深度<br className="lg:hidden" />肌肤检测报告
              </h2>
              <p className="text-[#5c4937] text-xs lg:text-xs max-w-xs leading-relaxed mb-6 lg:mb-8 font-medium tracking-wide relative z-10">
                基于千万级亚洲肌肤数据库，<br className="lg:hidden" />全方位解析您的肌肤问题。
              </p>
            </div>

          </div>

          {/* Right Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 lg:gap-4 flex-1 max-w-[170px] mx-auto lg:max-w-none">
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
                <p className="text-[11px] lg:text-xs text-[#7a6552] font-medium shrink-0">综合评分</p>
                <div className="flex items-baseline">
                  <span className="text-[11px] lg:text-3xl font-bold text-[#5c4937] leading-none">
                    <AnimatedNumber value={score} duration={1.5} />
                  </span>
                  <span className="text-[11px] lg:text-xs text-[#7a6552] ml-0.5 font-medium">分</span>
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
                <p className="text-[12px] lg:text-xs text-[#7a6552] font-medium shrink-0">肌肤年龄</p>
                <div className="flex items-baseline">
                  <span className="text-[13px] lg:text-3xl font-bold text-[#5c4937] leading-none">
                    <AnimatedNumber value={skinAge} duration={1.5} />
                  </span>
                  <span className="text-[12px] lg:text-xs text-[#7a6552] ml-0.5 font-medium">岁</span>
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
                <p className="text-[11px] lg:text-xs text-[#7a6552] font-medium shrink-0">油脂分泌</p>
                <div className="flex items-baseline">
                  <span className="text-[11px] lg:text-xl font-bold text-[#5c4937] leading-tight">{tZoneLabel}</span>
                </div>
              </div>
            </motion.div>

            {/* Last slot: Unlocked */}
            <div
              className="hidden lg:flex p-3 lg:p-4 rounded-xl lg:rounded-2xl flex-row lg:flex-col items-center lg:items-start justify-between lg:aspect-[2/3] min-h-[48px] lg:min-h-0 relative overflow-hidden"
              style={{
                background: '#DDD8CE',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              <div className="flex flex-row lg:flex-col items-center lg:items-start gap-2 lg:justify-between w-full h-full relative z-20">
                <p className="text-[12px] lg:text-xs text-[#7a6552] font-medium shrink-0">详情</p>
                <div className="flex items-center">
                  <span className="text-[13px] lg:text-xl font-bold text-[#5c4937]">已解锁</span>
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
