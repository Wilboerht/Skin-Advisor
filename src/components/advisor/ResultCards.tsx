'use client';

import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { getScoreBand, SCORE_DIRECTION_HINT } from '@/lib/score-bands';

interface ResultCardsProps {
  score?: number;
  skinAge?: number;
  skinAgeRange?: [number, number];
  skinAgeFactors?: string[];
  /** 问卷/面部分析得出的肤质标签 */
  skinTypeLabel?: string;
  /** 本次主要关注点（问卷 concerns 映射后的中文标签） */
  concernsLabel?: string;
  nickname: string;
  dataSource?: "comprehensive" | "questionnaire" | "hybrid";
}

const AnimatedNumber = ({ value, duration = 1.5 }: { value: number; duration?: number }) => {
  // prefers-reduced-motion：直接呈现最终值，跳过逐帧数字滚动
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? Math.round(value)
      : 0
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(Math.round(value));
      return;
    }
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
  }, [value, duration, prefersReducedMotion]);
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

/**
 * KPI 卡：综合评分 / 肌肤年龄 / 肤质类型 / 主要关注。
 * 十维明细由 DimensionRadarChart 承载，这里只保留不重复的摘要指标。
 */
export default function ResultCards({
  score,
  skinAge,
  skinAgeRange,
  skinAgeFactors,
  skinTypeLabel,
  concernsLabel,
  nickname,
  dataSource,
}: ResultCardsProps) {
  const scoreBand = getScoreBand(score);
  const isQuestionnaireOnly = dataSource === 'questionnaire';

  return (
    <div className="w-full flex flex-col gap-6" aria-label={`${nickname || '用户'}的肤质检测结果`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative rounded-[32px] p-6 lg:p-10 border border-brand-espresso/8 overflow-hidden"
        style={{
          background: '#F5F2ED',
          boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-0 lg:gap-12 h-full">
          <div className="flex flex-col justify-between items-start w-full lg:w-[30%] shrink-0">
            <div>
              <div className="relative z-10 mb-4 inline-flex h-[24px] px-2 items-center justify-center rounded-full border border-[var(--color-brand-charcoal)]/15 bg-transparent text-xs font-bold text-[var(--color-brand-charcoal)] lg:mb-6 lg:h-[26px] lg:px-2.5 lg:text-xs lg:tracking-wide lg:rounded-lg lg:border lg:border-[var(--color-brand-charcoal)]/30 whitespace-nowrap">
                专业版报告
              </div>
              <h2 className="text-lg lg:text-2xl font-bold text-brand-espresso mb-2 relative z-10">
                深度肌肤检测报告
              </h2>
              <p className="text-[var(--color-brand-cocoa)] text-xs lg:text-xs max-w-xs leading-relaxed mb-2 font-medium tracking-wide relative z-10">
                {isQuestionnaireOnly
                  ? '本次未进行面部影像分析，报告基于您的问卷回答生成。'
                  : '基于面部影像十维检测与您的问卷数据，全方位解析您的肌肤状态。'}
              </p>
              <p className="text-[11px] text-[var(--color-brand-taupe)] leading-relaxed mb-4 lg:mb-8 relative z-10">
                {SCORE_DIRECTION_HINT}
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
                <div className="flex flex-col items-end lg:items-start gap-1">
                  <div className="flex items-baseline">
                    <span className="text-xs lg:text-3xl font-bold text-[var(--color-brand-charcoal)] lg:text-[var(--color-brand-cocoa)] leading-none">
                      {score === undefined ? '-' : <AnimatedNumber value={score} duration={1.5} />}
                    </span>
                    {score !== undefined && (
                      <span className="text-xs lg:text-xs text-[#7a6552] ml-0.5 font-medium">分</span>
                    )}
                  </div>
                  {scoreBand && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ color: scoreBand.color, background: scoreBand.background }}
                    >
                      {scoreBand.label}
                    </span>
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
                <div className="flex flex-col items-end lg:items-start gap-1">
                  <div className="flex items-baseline">
                    <span className="text-xs lg:text-2xl font-bold text-[var(--color-brand-charcoal)] lg:text-[var(--color-brand-cocoa)] leading-none">
                      {skinAge === undefined ? '-' : <>约 <AnimatedNumber value={skinAge} duration={1.5} /></>}
                    </span>
                    {skinAge !== undefined && (
                      <span className="text-xs lg:text-xs text-[#7a6552] ml-0.5 font-medium">岁</span>
                    )}
                  </div>
                  {skinAgeRange && (
                    <span className="text-[10px] text-[var(--color-brand-taupe)]">
                      参考 {skinAgeRange[0]}–{skinAgeRange[1]} 岁
                    </span>
                  )}
                  {skinAgeFactors && skinAgeFactors.length > 0 && (
                    <span className="hidden lg:block text-[10px] leading-snug text-[var(--color-brand-taupe)] line-clamp-2" title={skinAgeFactors.join('、')}>
                      依据：{skinAgeFactors.slice(0, 2).join('、')}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Skin Type */}
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
                <p className="text-xs lg:text-xs text-[#7a6552] font-medium shrink-0">肤质类型</p>
                <p className="text-xs lg:text-lg font-bold leading-snug text-right lg:text-left text-[var(--color-brand-charcoal)] lg:text-[var(--color-brand-cocoa)] line-clamp-2">
                  {skinTypeLabel || '-'}
                </p>
              </div>
            </motion.div>

            {/* Main Concern */}
            <div
              className="flex p-3 lg:p-4 rounded-xl lg:rounded-2xl flex-row lg:flex-col items-center lg:items-start justify-between lg:aspect-[2/3] min-h-[48px] lg:min-h-0 relative overflow-hidden"
              style={{
                background: '#DDD8CE',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              <div className="flex flex-row lg:flex-col items-center lg:items-start gap-2 lg:justify-between w-full h-full relative z-20">
                <p className="text-xs lg:text-xs text-[#7a6552] font-medium shrink-0">主要关注</p>
                <p className="text-xs lg:text-lg font-bold leading-snug text-right lg:text-left text-[var(--color-brand-charcoal)] lg:text-[var(--color-brand-cocoa)] line-clamp-2">
                  {concernsLabel || '暂无重点'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
