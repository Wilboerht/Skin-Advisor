"use client";

import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
  onNext: () => void;
  direction: number; // 1: 向前, -1: 向后
  currentStep: number;
  totalSteps: number;
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
  onNext,
  direction,
  currentStep,
  totalSteps,
}: QuestionStepProps) {
  // 检测用户是否偏好减少动画
  const prefersReducedMotion = useReducedMotion();

  // 根据用户偏好选择动画配置
  const variants = prefersReducedMotion ? reducedMotionVariants : slideVariants;
  const transition = prefersReducedMotion ? reducedMotionTransition : slideTransition;

  const isNextDisabled = !selectedValue || (Array.isArray(selectedValue) && selectedValue.length === 0);
  const selectedCount = Array.isArray(selectedValue) ? selectedValue.length : selectedValue ? 1 : 0;
  const showNextButton = question.type === "multiple" || (currentStep === totalSteps && !isNextDisabled);

  const nextLabel = (() => {
    if (isNextDisabled) return "请至少选择一项";
    if (currentStep === totalSteps) {
      return question.type === "multiple" ? `已选 ${selectedCount} 项，开始面部检测` : "开始面部检测";
    }
    return `已选 ${selectedCount} 项，点击继续`;
  })();

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
        <div className="text-center mb-6 md:mb-8 pt-2 sm:pt-8 md:pt-4">
          <m.h2
            className="text-2xl md:text-3xl lg:text-4xl font-serif text-[#1A1A1A] leading-snug"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            {question.question}
          </m.h2>

          {question.subtext && (
            <m.p
              className="mt-3 text-sm md:text-[15px] text-[#5E5E5E] font-light leading-relaxed max-w-lg mx-auto text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {question.subtext}
            </m.p>
          )}
        </div>

        {/* Options - Grid Layout on Desktop */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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

        {/* Next Button - Centered below options */}
        <AnimatePresence>
          {showNextButton && (
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mt-8 md:mt-10 flex justify-center"
            >
              <button
                type="button"
                onClick={onNext}
                disabled={isNextDisabled}
                className={cn(
                  "relative overflow-hidden text-[13px] font-medium tracking-[0.15em] transition-colors duration-300 flex items-center justify-center gap-2",
                  "py-3 px-8 bg-transparent border-b",
                  isNextDisabled
                    ? "text-[#8B7355]/30 border-[#8B7355]/30 cursor-not-allowed"
                    : "text-[#8B7355] border-[#8B7355] before:absolute before:inset-0 before:bg-[#8B7355]/10 before:w-0 hover:before:w-full before:transition-all before:duration-300 before:ease-out before:left-0 before:right-auto"
                )}
              >
                <span className="relative z-10">{nextLabel}</span>
                {!isNextDisabled && <ChevronRight className="relative z-10 h-4 w-4" />}
              </button>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </AnimatePresence>
  );
}
