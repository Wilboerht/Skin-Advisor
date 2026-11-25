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
                "flex cursor-pointer items-start gap-3 rounded-xl p-4 text-card-foreground",
                SELECTABLE_CARD,
                isSelected && SELECTABLE_CARD_SELECTED,
            )}
        >
            {role === "radio" ? (
                <RadioGroupItem value={value} id={id} className="mt-0.5" />
            ) : (
                <Checkbox
                    id={id}
                    checked={isSelected}
                    onCheckedChange={() => onSelect()}
                    className="mt-0.5"
                />
            )}
            <span className="grid gap-1.5">
                <span className="text-sm leading-none font-medium">
                    {label}
                </span>
                {description && (
                    <span className="text-sm text-muted-foreground">
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
}
