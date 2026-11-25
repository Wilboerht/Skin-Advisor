"use client";

import { useEffect, useId, useState } from "react";
import { Venus, Mars } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    SELECTABLE_CARD,
    SELECTABLE_CARD_SELECTED,
} from "@/components/ui/selection-styles";

type Gender = "female" | "male";

interface GenderSelectionProps {
    onSelect: (gender: Gender) => void;
    /** 预选性别（来自资料或历史记录时高亮显示，仍需用户确认） */
    selectedGender?: Gender | null;
    /** 标题按性别来源分情况：首次选择 / 历史测肤记录 / 个人账号信息 */
    title?: string;
}

export function GenderSelection({
    onSelect,
    selectedGender,
    title = "开始之前，请选择您的性别",
}: GenderSelectionProps) {
    const options = [
        { value: "female" as const, label: "女性", Icon: Venus },
        { value: "male" as const, label: "男性", Icon: Mars },
    ];
    const helperId = useId();
    const [selected, setSelected] = useState<Gender | "">(
        selectedGender ?? "",
    );
    const [manuallySelected, setManuallySelected] = useState(false);

    useEffect(() => {
        if (selectedGender) setSelected(selectedGender);
    }, [selectedGender]);

    return (
        <div className="flex w-full max-w-2xl flex-col items-center gap-8">
            <div className="space-y-2 text-center">
                <h2 className="text-xl font-light tracking-tight md:text-2xl">
                    {title}
                </h2>
                <p
                    id={helperId}
                    className="text-sm text-muted-foreground"
                >
                    {selectedGender
                        ? "请确认后继续"
                        : "用于匹配更准确的护肤方案"}
                </p>
            </div>

            <RadioGroup
                value={selected}
                onValueChange={(value) => {
                    setManuallySelected(true);
                    setSelected(value as Gender);
                }}
                className="grid w-full gap-3 sm:grid-cols-2"
                aria-label="选择性别"
                aria-describedby={helperId}
            >
                {options.map(({ value, label, Icon }) => {
                    const id = `gender-${value}`;
                    const isSelected = selected === value;
                    const isPreselected =
                        !manuallySelected &&
                        isSelected &&
                        selectedGender === value;
                    return (
                        <label
                            key={value}
                            htmlFor={id}
                            onClick={() => {
                                if (isPreselected) setManuallySelected(true);
                            }}
                            className={cn(
                                "flex min-h-[88px] cursor-pointer items-center gap-4 rounded-xl p-5 text-card-foreground",
                                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30",
                                SELECTABLE_CARD,
                                isSelected && SELECTABLE_CARD_SELECTED,
                            )}
                        >
                            <span
                                className={cn(
                                    "flex size-12 shrink-0 items-center justify-center rounded-full transition-colors",
                                    isSelected
                                        ? "bg-primary/10 text-primary"
                                        : "bg-muted text-muted-foreground",
                                )}
                            >
                                <Icon className="size-6" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1 text-[15px] font-normal text-foreground/90">
                                {label}
                            </span>
                            <RadioGroupItem
                                value={value}
                                id={id}
                                className={cn(
                                    "shrink-0 shadow-none",
                                    isPreselected && "sr-only",
                                )}
                            />
                            {isPreselected && (
                                <Badge
                                    variant="default"
                                    className="shrink-0 rounded-full border border-primary/20 bg-card px-2.5 py-1 text-[11px] font-normal leading-none text-primary shadow-none"
                                >
                                    当前
                                </Badge>
                            )}
                        </label>
                    );
                })}
            </RadioGroup>

            <Button
                type="button"
                disabled={!selected}
                onClick={() => {
                    if (selected) onSelect(selected);
                }}
                className="w-full sm:w-auto sm:min-w-[200px]"
            >
                确认并继续
            </Button>
        </div>
    );
}
