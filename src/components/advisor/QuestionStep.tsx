"use client";

import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { type Question } from "@/config/questions";
import { OptionCard } from "./OptionCard";
import {
  slideVariants,
  slideTransition,
  reducedMotionVariants,
  reducedMotionTransition,
} from "./animations";

interface QuestionStepProps {
  question: Question;
  selectedValue: string | string[] | null;
  onSelect: (value: string) => void;
  direction: number; // 1: 向前, -1: 向后
}

/**
 * 问题步骤组件 - NIHPLOD 高奢品牌风格
 * 显示单个问题及其选项，支持优雅的动画过渡
 *
 * 功能：
 * - 进入动画：从右侧滑入（向前）/ 从左侧滑入（向后）
 * - 退出动画：向左侧滑出（向前）/ 向右侧滑出（向后）
 * - 支持 prefers-reduced-motion 降级
 */
export function QuestionStep({
  question,
  selectedValue,
  onSelect,
  direction,
}: QuestionStepProps) {
  // 检测用户是否偏好减少动画
  const prefersReducedMotion = useReducedMotion();

  // 根据用户偏好选择动画配置
  const variants = prefersReducedMotion ? reducedMotionVariants : slideVariants;
  const transition = prefersReducedMotion ? reducedMotionTransition : slideTransition;

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <m.div
        key={question.id}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={transition}
        className="w-full"
      >
        {/* Header - Centered & Clean */}
        <div className="text-center mb-8 md:mb-14 pt-4 sm:pt-12">
          <m.h2
            className="text-2xl md:text-4xl font-serif text-[#1A1A1A] mb-4 leading-snug max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            {question.question}
          </m.h2>

          {question.subtext && (
            <m.p
              className="text-sm md:text-[15px] text-[#5E5E5E] font-light leading-relaxed max-w-lg mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {question.subtext}
            </m.p>
          )}
        </div>

        {/* Options - Grid Layout on Desktop */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
          {question.options.map((option, index) => {
            const isSelected = Array.isArray(selectedValue)
              ? selectedValue.includes(option.value)
              : selectedValue === option.value;

            return (
              <OptionCard
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
                emoji={option.emoji}
                isSelected={isSelected}
                onClick={() => onSelect(option.value)}
                index={prefersReducedMotion ? 0 : index}
              />
            );
          })}
        </div>
      </m.div>
    </AnimatePresence>
  );
}
