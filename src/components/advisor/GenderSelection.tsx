"use client";

import type { KeyboardEvent } from "react";
import { m } from "framer-motion";
import { Venus, Mars, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface GenderSelectionProps {
    onSelect: (gender: "female" | "male") => void;
    /** 预选性别（来自资料或历史记录时高亮显示，仍需用户点击确认） */
    selectedGender?: "female" | "male" | null;
    /** 标题按性别来源分情况：首次选择 / 历史测肤记录 / 个人账号信息 */
    title?: string;
}

export function GenderSelection({ onSelect, selectedGender, title = "开始之前，请选择您的性别" }: GenderSelectionProps) {
    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    const options = [
        { value: "female" as const, label: "女性", Icon: Venus },
        { value: "male" as const, label: "男性", Icon: Mars },
    ];

    // radiogroup 键盘行为：方向键切换选项（与卡片单击等价，两选项页面直接前进）
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            onSelect("female");
        } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            onSelect("male");
        }
    };

    return (
        // -mt-8（仅移动端）：父容器为 justify-center 垂直居中，移动端正中位置偏低，
        // 该负边距把性别选择视觉上移，让标题与选项落在屏幕视觉中心。
        // 改动前请在真机验证：性别页由父级 h-full 容器居中，直接移除会整体下沉。
        <div className="flex w-full flex-col items-center -mt-8 sm:mt-0">
            <m.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center font-serif font-light text-lg md:text-2xl text-brand-charcoal tracking-[0.02em]"
            >
                {title}
            </m.h2>

            {selectedGender && (
                <m.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3 mb-8 text-center text-[13px] font-light text-brand-charcoal/55"
                >
                    点击卡片确认，或选择另一项
                </m.p>
            )}

            <div
                className={cn("grid w-full max-w-sm sm:max-w-md sm:grid-cols-2 gap-3 sm:gap-5", !selectedGender && "mt-8")}
                role="radiogroup"
                aria-label="选择性别"
                onKeyDown={handleKeyDown}
            >
                {/* 容器用 div 承载标题等内容；点击/ARIA/焦点由覆盖层 button 承担 */}
                {options.map(({ value, label, Icon }) => {
                    const isSelected = selectedGender === value;
                    return (
                        <m.div
                            key={value}
                            variants={item}
                            className={cn(
                                "group relative flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:gap-4 rounded-2xl border bg-white px-5 sm:px-8 py-5 sm:py-9 text-left sm:text-center transition-all duration-300",
                                isSelected
                                    ? "border-brand-charcoal/40 bg-brand-charcoal/[0.02] shadow-[0_8px_24px_rgba(0,38,62,0.06)]"
                                    : "border-[var(--color-brand-espresso)]/[0.10] hover:border-[var(--color-brand-espresso)]/[0.20] hover:shadow-[0_8px_24px_rgba(61,47,37,0.06)]"
                            )}
                        >
                            <m.button
                                type="button"
                                onClick={() => onSelect(value)}
                                whileTap={{ scale: 0.98 }}
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={label}
                                className="absolute inset-0 z-10 rounded-2xl cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30 focus-visible:ring-offset-2"
                            />
                            <div
                                className={cn(
                                    "flex h-12 w-12 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                                    isSelected
                                        ? "bg-brand-charcoal/[0.09]"
                                        : "bg-brand-charcoal/[0.05] group-hover:bg-brand-charcoal/[0.08]"
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "h-6 w-6 sm:h-10 sm:w-10 transition-colors duration-300",
                                        isSelected ? "text-brand-charcoal" : "text-brand-charcoal/70"
                                    )}
                                    strokeWidth={1.5}
                                />
                            </div>

                            <div>
                                <h3 className="text-lg sm:text-xl font-serif font-light text-brand-charcoal">{label}</h3>
                            </div>

                            {isSelected && (
                                <span className="absolute right-3 top-3 sm:right-4 sm:top-4 flex h-5 w-5 items-center justify-center rounded-full bg-brand-charcoal text-white">
                                    <Check className="h-3 w-3" strokeWidth={2.5} />
                                </span>
                            )}
                        </m.div>
                    );
                })}
            </div>
        </div>
    );
}
