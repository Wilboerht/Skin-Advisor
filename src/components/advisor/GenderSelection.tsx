"use client";

import { useEffect, useId, useState } from "react";
import { Venus, Mars } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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

    useEffect(() => {
        if (selectedGender) setSelected(selectedGender);
    }, [selectedGender]);

    return (
        <div className="flex w-full max-w-md flex-col items-center gap-6">
            <div className="space-y-2 text-center">
                <h2 className="text-lg font-semibold tracking-tight md:text-2xl">
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
                onValueChange={(value) => setSelected(value as Gender)}
                className="grid w-full gap-3 sm:grid-cols-2"
                aria-label="选择性别"
                aria-describedby={helperId}
            >
                {options.map(({ value, label, Icon }) => {
                    const id = `gender-${value}`;
                    const isSelected = selected === value;
                    const isPreselected = isSelected && selectedGender === value;
                    return (
                        <label
                            key={value}
                            htmlFor={id}
                            className={cn(
                                "flex min-h-[88px] cursor-pointer items-center gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-colors",
                                "hover:bg-accent/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30",
                                isSelected
                                    ? "border-primary/40 bg-accent ring-1 ring-primary/10 hover:bg-accent"
                                    : "border-border/80 hover:border-primary/20",
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
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                                <span className="text-sm font-medium">
                                    {label}
                                </span>
                                {isPreselected && (
                                    <Badge variant="default" className="shrink-0">
                                        当前
                                    </Badge>
                                )}
                            </span>
                            <RadioGroupItem
                                value={value}
                                id={id}
                                className="shrink-0"
                            />
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
                className="w-full sm:w-auto sm:min-w-40"
            >
                确认并继续
            </Button>
        </div>
    );
}
