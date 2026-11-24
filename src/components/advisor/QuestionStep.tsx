"use client";

import { m, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { type Question } from "@/config/questions";
import { OptionCard } from "./OptionCard";

interface QuestionStepProps {
  question: Question;
  selectedValue: string | string[] | null;
  onSelect: (value: string, options?: { autoAdvance?: boolean }) => void;
  onNext: () => void;
  currentStep: number;
  totalSteps: number;
}

/**
 * 问题步骤组件 - NIHPLOD 高奢品牌风格
 * 显示单个问题及其选项，支持优雅的动画过渡
 *
 * 功能：
 * - 切题滑入滑出由外层 page 的 AnimatePresence 负责，本组件不再叠加任何入场动画，
 *   避免一层容器 + 一层子元素的重复入场，也避免 iOS 上位移中 tap 命中偏移
 * - 支持 prefers-reduced-motion 降级
 */
export function QuestionStep({
  question,
  selectedValue,
  onSelect,
  onNext,
  currentStep,
  totalSteps,
}: QuestionStepProps) {

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
    // 键盘方向键只移动选择，不自动切题；用户按 Enter/继续按钮再进入下一题
    onSelect(values[nextIdx], { autoAdvance: false });
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
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-light text-brand-charcoal leading-snug tracking-[0.02em]">
            {question.question}
          </h2>

          {question.subtext && (
            <p className="mt-3 text-sm md:text-[15px] text-brand-charcoal/75 font-light leading-[1.8] md:leading-normal tracking-[0.06em] md:tracking-[0.12em] max-w-lg mx-auto text-center">
              {question.subtext}
            </p>
          )}
          {currentStep === 1 && (
            <p className="mt-3 text-[12px] font-light tracking-[0.08em] text-brand-charcoal/45">
              预计约 2 分钟完成
            </p>
          )}
          {["pregnancy", "menstrualCycle", "medicalBeauty", "allergies"].includes(question.fieldName) && (
            <p className="mt-3 text-[11px] font-light leading-relaxed text-brand-charcoal/45">
              该信息仅用于安全筛查与方案避雷，不会在报告中公开展示。
            </p>
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
          {question.options.map((option) => {
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
                role={question.type === "multiple" ? "checkbox" : "radio"}
              />
            );
          })}
        </div>

        {/* Next Button - Centered below options */}
        <AnimatePresence>
          {showNextButton && (
            <m.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mt-6 md:mt-8 flex justify-center"
            >
              <Button
                type="button"
                variant="ghost"
                onClick={onNext}
                disabled={isNextDisabled}
                rightIcon={
                  !isNextDisabled ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : undefined
                }
                className={`min-h-[48px] min-w-[140px] rounded-full px-6 py-3 text-[13px] tracking-[0.1em] hover:bg-transparent disabled:opacity-100 sm:px-8 sm:py-4 ${
                  isNextDisabled
                    ? "cursor-not-allowed text-brand-charcoal/30"
                    : "text-brand-charcoal/70 hover:text-brand-charcoal"
                }`}
              >
                {nextLabel}
              </Button>
            </m.div>
          )}
        </AnimatePresence>
      </div>
  );
}
