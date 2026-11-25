"use client";

import { useRef } from "react";
import { type Question } from "@/config/questions";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { OptionCard } from "./OptionCard";

interface QuestionStepProps {
  question: Question;
  selectedValue: string | string[] | null;
  onSelect: (value: string, options?: { autoAdvance?: boolean }) => void;
  onNext: () => void;
  currentStep: number;
  totalSteps: number;
}

const SENSITIVE_FIELDS = [
  "pregnancy",
  "menstrualCycle",
  "medicalBeauty",
  "allergies",
];

/**
 * 问题步骤：shadcn 原生表单样式
 * - 单选：RadioGroup + RadioGroupItem
 * - 多选：Checkbox
 * - 提交：原生 Button（禁用态使用 shadcn 默认样式）
 */
export function QuestionStep({
  question,
  selectedValue,
  onSelect,
  onNext,
  currentStep,
  totalSteps,
}: QuestionStepProps) {
  const isMultiple = question.type === "multiple";
  const isNextDisabled =
    !selectedValue ||
    (Array.isArray(selectedValue) && selectedValue.length === 0);
  const pointerSelectRef = useRef(false);

  const handleValueChange = (value: string) => {
    onSelect(value, { autoAdvance: pointerSelectRef.current });
    pointerSelectRef.current = false;
  };

  const options = question.options.map((option) => {
    const isSelected = Array.isArray(selectedValue)
      ? selectedValue.includes(option.value)
      : selectedValue === option.value;

    return (
      <OptionCard
        key={option.value}
        value={option.value}
        label={option.label}
        description={option.description}
        isSelected={isSelected}
        onSelect={() => onSelect(option.value)}
        role={isMultiple ? "checkbox" : "radio"}
      />
    );
  });

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {question.question}
        </h2>

        {question.subtext && (
          <p className="text-sm text-muted-foreground">{question.subtext}</p>
        )}

        {currentStep === 1 && (
          <p className="text-xs text-muted-foreground">预计约 2 分钟完成</p>
        )}

        {SENSITIVE_FIELDS.includes(question.fieldName) && (
          <p className="text-xs text-muted-foreground">
            该信息仅用于安全筛查与方案避雷，不会在报告中公开展示。
          </p>
        )}
      </div>

      {isMultiple ? (
        <div
          role="group"
          aria-label={question.question}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          {options}
        </div>
      ) : (
        <RadioGroup
          value={typeof selectedValue === "string" ? selectedValue : ""}
          onValueChange={handleValueChange}
          onPointerDown={() => {
            pointerSelectRef.current = true;
          }}
          onKeyDown={() => {
            pointerSelectRef.current = false;
          }}
          aria-label={question.question}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          {options}
        </RadioGroup>
      )}

      <div className="mt-8 flex justify-center">
        <Button
          type="button"
          variant={isNextDisabled ? "outline" : "default"}
          onClick={onNext}
          disabled={isNextDisabled}
          className={cn(
            "min-w-40",
            isNextDisabled &&
              "border-border/80 bg-transparent text-muted-foreground/60 shadow-none hover:bg-transparent disabled:opacity-100",
          )}
        >
          {currentStep === totalSteps ? "开始面部检测" : "下一步"}
        </Button>
      </div>
    </div>
  );
}
