"use client";

import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Question } from "@/config/questions";
import { OptionCard } from "./OptionCard";
import { useIsTouch } from "@/hooks/useMediaQuery";

interface QuestionStepProps {
  question: Question;
  selectedValue: string | string[] | null;
  onSelect: (value: string) => void;
  onNext: () => void;
  direction: number; // 1: 向前, -1: 向后（切题滑入滑出由外层 page 的 AnimatePresence 负责）
  currentStep: number;
  totalSteps: number;
}

/**
 * 问题步骤组件 - NIHPLOD 高奢品牌风格
 * 显示单个问题及其选项，支持优雅的动画过渡
 *
 * 功能：
 * - 切题滑入滑出由外层 page 的 AnimatePresence 负责，本组件不再叠加位移动画，
 *   避免 iOS 上多层动画叠加导致选项长时间处于位移中、tap 命中偏移
 * - 支持 prefers-reduced-motion 降级
 * - 触屏设备（hover: none）选项无逐卡入场延迟
 */
export function QuestionStep({
  question,
  selectedValue,
  onSelect,
  onNext,
  currentStep,
  totalSteps,
}: QuestionStepProps) {
  // 检测用户是否偏好减少动画
  const prefersReducedMotion = useReducedMotion();
  // 触屏设备上去掉逐卡入场延迟，缩短选项处于动画中的时间
  const isTouch = useIsTouch();

  const isNextDisabled = !selectedValue || (Array.isArray(selectedValue) && selectedValue.length === 0);
  const selectedCount = Array.isArray(selectedValue) ? selectedValue.length : selectedValue ? 1 : 0;
  const showNextButton = question.type === "multiple" || (currentStep === totalSteps && !isNextDisabled);

  // 单选题支持方向键切换选项（符合 radiogroup 键盘惯例）
  const handleGroupKeyDown = (e: React.KeyboardEvent) => {
    if (question.type !== "single") return;
    if (e.key !== "ArrowDown" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const values = question.options.map((o) => o.value);
    const currentIdx = values.indexOf(typeof selectedValue === "string" ? selectedValue : "");
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const nextIdx = currentIdx === -1
      ? (delta === 1 ? 0 : values.length - 1)
      : (currentIdx + delta + values.length) % values.length;
    onSelect(values[nextIdx]);
  };

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
      <div className="w-full">
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
          onKeyDown={handleGroupKeyDown}
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
                index={prefersReducedMotion || isTouch ? 0 : index}
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
      </div>
  );
}
