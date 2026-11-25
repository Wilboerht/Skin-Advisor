"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroupItem } from "@/components/ui/radio-group";
import {
    SELECTABLE_CARD,
    SELECTABLE_CARD_SELECTED,
} from "@/components/ui/selection-styles";

interface OptionCardProps {
    value: string;
    label: string;
    description?: string;
    isSelected: boolean;
    onSelect: () => void;
    role?: "radio" | "checkbox";
}

/**
 * 选项行：使用 shadcn 原生 Card + RadioGroupItem / Checkbox 样式
 */
export function OptionCard({
    value,
    label,
    description,
    isSelected,
    onSelect,
    role = "radio",
}: OptionCardProps) {
    const id = useId();

    return (
        <label
            htmlFor={id}
            className={cn(
                "flex cursor-pointer items-center gap-3.5 rounded-xl px-4 py-4 text-card-foreground",
                SELECTABLE_CARD,
                isSelected && SELECTABLE_CARD_SELECTED,
            )}
        >
            {role === "radio" ? (
                <RadioGroupItem value={value} id={id} className="shadow-none" />
            ) : (
                <Checkbox
                    id={id}
                    checked={isSelected}
                    onCheckedChange={() => onSelect()}
                    className="shadow-none"
                />
            )}
            <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm leading-snug font-normal text-foreground/90">
                    {label}
                </span>
                {description && (
                    <span className="text-[13px] leading-relaxed text-muted-foreground/85">
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
}
