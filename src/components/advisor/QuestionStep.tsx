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
      if (question.type === "multiple") {
        return `已选 ${selectedCount} 项，开始面部检测`;
      }
      return "开始面部检测";
    }
    return `已选 ${selectedCount} 项，点击继续`;
  })();

  return (
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
        <div className="text-center mb-8 pt-8 sm:pt-10 md:pt-6">
          <m.h2
            className="text-2xl md:text-3xl lg:text-4xl font-serif font-light text-brand-charcoal leading-snug tracking-[0.02em]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            {question.question}
          </m.h2>

          {question.subtext && (
            <m.p
              className="mt-3 text-sm md:text-[15px] text-brand-charcoal/75 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em] max-w-lg mx-auto text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {question.subtext}
            </m.p>
          )}
        </div>

        {/* Options - Grid Layout on Desktop */}
        <div
          className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4"
          role={question.type === "multiple" ? "group" : "radiogroup"}
          aria-label={question.question}
          aria-multiselectable={question.type === "multiple" ? true : undefined}
        >
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
                role={question.type === "multiple" ? "checkbox" : "radio"}
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
              className="mt-6 md:mt-8 flex justify-center"
            >
              <button
                type="button"
                onClick={onNext}
                disabled={isNextDisabled}
                className={cn(
                  "text-[13px] font-medium tracking-[0.1em] transition-all duration-300 flex items-center justify-center gap-2",
                  "min-h-[48px] min-w-[140px] py-3 px-6 sm:py-4 sm:px-8 rounded-full touch-manipulation active:scale-95 bg-transparent",
                  isNextDisabled
                    ? "text-brand-charcoal/30 cursor-not-allowed"
                    : "text-brand-charcoal/70 hover:text-brand-charcoal"
                )}
              >
                <span>{nextLabel}</span>
                {!isNextDisabled && <ChevronRight className="h-4 w-4" />}
              </button>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
  );
}
