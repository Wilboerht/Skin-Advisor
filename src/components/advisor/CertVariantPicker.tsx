"use client";

import Image from "next/image";
import { certImageUrl, type CertVariant } from "@/lib/cert-image";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface CertVariantPickerProps {
    isOpen: boolean;
    persona: string;
    gender: string;
    selectedId: CertVariant;
    onSelect: (variant: CertVariant) => void;
    onClose: () => void;
}

const VARIANTS: { id: CertVariant; label: string; desc: string }[] = [
    { id: "qr", label: "标准版", desc: "含综合评分与二维码" },
    { id: "noqr", label: "分享版", desc: "无二维码、无评分区，适合小红书等平台分享" },
];

/**
 * 「保存测肤证书」版本选择弹层
 * 统一 ResponsiveDialog + RadioGroup
 */
export function CertVariantPicker({
    isOpen,
    persona,
    gender,
    selectedId,
    onSelect,
    onClose,
}: CertVariantPickerProps) {
    return (
        <ResponsiveDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="选择证书版式"
            description="点击任一版式即可生成并保存"
            size="md"
        >
            <RadioGroup
                value={selectedId}
                onValueChange={(value) => onSelect(value as CertVariant)}
                className="grid grid-cols-2 gap-3"
                aria-label="选择证书版式"
            >
                {VARIANTS.map((variant) => {
                    const active = variant.id === selectedId;
                    const id = `cert-variant-${variant.id}`;
                    return (
                        <label
                            key={variant.id}
                            htmlFor={id}
                            className={cn(
                                "relative flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50",
                                active && "border-primary bg-accent",
                            )}
                        >
                            <RadioGroupItem
                                value={variant.id}
                                id={id}
                                className="absolute top-3 right-3 z-10 bg-background"
                            />
                            <span className="block overflow-hidden rounded-md border bg-muted">
                                <Image
                                    src={certImageUrl(persona, gender, variant.id)}
                                    alt={variant.label}
                                    width={360}
                                    height={480}
                                    className="h-auto w-full"
                                />
                            </span>
                            <span className="text-sm font-medium">
                                {variant.label}
                            </span>
                            <span className="text-xs leading-snug text-muted-foreground">
                                {variant.desc}
                            </span>
                        </label>
                    );
                })}
            </RadioGroup>
        </ResponsiveDialog>
    );
}
