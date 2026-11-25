"use client";

import Image from "next/image";
import Link from "next/link";
import { createElement } from "react";
import { ArrowRight, MoonStar, Sunrise } from "lucide-react";
import type { SkinTypeData } from "@/lib/result-content";
import {
    getFactionAccent,
    getFactionIcon,
    getFactionPortraitSpot,
} from "@/components/website/faction-icons";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";

interface SkinTypeModalProps {
    data: SkinTypeData | null;
    onClose: () => void;
    hideTestCTA?: boolean;
}

/**
 * SkinTypeModal — 肌智派类型详情弹窗
 * 统一 ResponsiveDialog + Badge + Button
 */
export function SkinTypeModal({
    data,
    onClose,
    hideTestCTA = false,
}: SkinTypeModalProps) {
    return (
        <ResponsiveDialog
            open={Boolean(data)}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={
                data ? (
                    <span className="inline-flex items-center gap-2">
                        {createElement(getFactionIcon(data.ipKey), {
                            className: "size-5 shrink-0 text-muted-foreground",
                            strokeWidth: 1.5,
                        })}
                        {data.typeName}
                    </span>
                ) : undefined
            }
            size="4xl"
            className="sm:max-w-[1100px]"
        >
            {data && (
                <div className="space-y-8">
                    <div className="flex flex-col items-center text-center">
                        <div className="relative mb-5 flex items-center justify-center">
                            <span
                                aria-hidden="true"
                                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30"
                                style={{
                                    backgroundColor: getFactionAccent(data.ipKey),
                                    left: `${getFactionPortraitSpot(data.ipKey).x}%`,
                                    top: `${getFactionPortraitSpot(data.ipKey).y}%`,
                                    height: `${getFactionPortraitSpot(data.ipKey).d}%`,
                                    width: `${(getFactionPortraitSpot(data.ipKey).d * 4) / 3}%`,
                                }}
                            />
                            <Image
                                src={`/images/character/${data.ipKey}/${data.ipKey}_female.webp`}
                                alt={`${data.typeName} 形象`}
                                width={180}
                                height={240}
                                className="relative h-44 w-auto object-contain md:h-56"
                            />
                        </div>
                        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-muted-foreground">
                            {data.m1.intro || data.m1.persona}
                        </p>
                    </div>

                    {(data.m5?.advantages?.length ?? 0) > 0 && (
                        <section>
                            <div className="rounded-lg border bg-muted/30 p-6 md:p-8">
                                <h3 className="mb-3 text-base font-semibold md:text-lg">
                                    {data.m5?.title || "优势高光"}
                                </h3>
                                <div className="divide-y">
                                    {data.m5!.advantages.map((advantage, index) => (
                                        <div
                                            key={index}
                                            className="flex gap-3.5 py-4"
                                        >
                                            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-medium">
                                                    {advantage.title}
                                                </h4>
                                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                                    {advantage.content}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {(data.m4?.morning || data.m4?.night) && (
                        <section>
                            <h3 className="mb-4 text-base font-semibold md:text-lg">
                                {data.m4?.title || "我们建议的护肤日常"}
                            </h3>
                            <div className="space-y-4">
                                {[
                                    {
                                        key: "morning",
                                        content: data.m4?.morning,
                                        Icon: Sunrise,
                                    },
                                    {
                                        key: "night",
                                        content: data.m4?.night,
                                        Icon: MoonStar,
                                    },
                                ].map((item) =>
                                    item.content ? (
                                        <div
                                            key={item.key}
                                            className="flex gap-3.5"
                                        >
                                            <item.Icon
                                                aria-hidden="true"
                                                strokeWidth={1.5}
                                                className="mt-0.5 size-6 shrink-0 text-muted-foreground"
                                            />
                                            <p className="text-sm leading-relaxed text-muted-foreground">
                                                {item.content}
                                            </p>
                                        </div>
                                    ) : null,
                                )}
                            </div>
                            {data.m4?.note && (
                                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                    {data.m4.note}
                                </p>
                            )}
                        </section>
                    )}

                    {data.m7 && (
                        <section>
                            <div className="rounded-lg border bg-muted/30 p-6 md:p-8">
                                <h3 className="mb-4 text-base font-semibold md:text-lg">
                                    {data.m7.title ||
                                        `${data.typeName}的精准护肤公式`}
                                </h3>
                                {data.m7.formulaCore && (
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {data.m7.formulaCore
                                            .split(/\s*[·・]\s*/)
                                            .filter(Boolean)
                                            .map((keyword) => (
                                                <Badge
                                                    key={keyword}
                                                    variant="outline"
                                                >
                                                    {keyword}
                                                </Badge>
                                            ))}
                                    </div>
                                )}
                                <div className="divide-y">
                                    {(data.m7.suggestions ?? []).map(
                                        (suggestion, index) => (
                                            <div
                                                key={index}
                                                className="py-4"
                                            >
                                                <div className="mb-2 flex items-baseline gap-3">
                                                    <span className="text-xl font-light text-muted-foreground/40">
                                                        {String(
                                                            index + 1,
                                                        ).padStart(2, "0")}
                                                    </span>
                                                    <h4 className="text-sm font-medium">
                                                        {suggestion.title}
                                                    </h4>
                                                </div>
                                                <p className="pl-9 text-sm leading-relaxed text-muted-foreground">
                                                    {suggestion.content}
                                                </p>
                                            </div>
                                        ),
                                    )}
                                </div>
                                {data.m7.onlyOneSet && (
                                    <div className="mt-3 border-l-2 pl-4">
                                        <Badge
                                            variant="secondary"
                                            className="mb-2"
                                        >
                                            参考护理组合
                                        </Badge>
                                        <p className="text-sm leading-relaxed">
                                            {data.m7.onlyOneSet}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {!hideTestCTA && (
                        <div className="flex justify-center">
                            <Link
                                href="/"
                                onClick={onClose}
                                className={buttonVariants({
                                    variant: "outline",
                                    size: "lg",
                                })}
                            >
                                完成肌肤状态检测，查看你的专属肌肤派系
                                <ArrowRight />
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </ResponsiveDialog>
    );
}
