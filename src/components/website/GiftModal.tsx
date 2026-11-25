"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { m, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { Button, buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** 彩带配色：品牌金/可可/藏蓝 + 派系点缀色 */
const CONFETTI_COLORS = ["#C9A86C", "#5c4937", "#00263E", "#E4A6B5", "#A8C6DF", "#E0A75E"];

function seededRandom(seed: number): number {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
}

function GiftConfetti() {
    const reduceMotion = useReducedMotion();
    const pieces = useMemo(
        () =>
            reduceMotion
                ? []
                : Array.from({ length: 48 }, (_, index) => ({
                      id: index,
                      x: seededRandom(index * 7 + 1) * 100,
                      delay: seededRandom(index * 13 + 2) * 0.5,
                      duration: 2.6 + seededRandom(index * 17 + 3) * 1.6,
                      size: 5 + seededRandom(index * 23 + 5) * 5,
                      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                      rotate: seededRandom(index * 29 + 7) * 360,
                      spin: 240 + seededRandom(index * 31 + 11) * 360,
                      drift: (seededRandom(index * 37 + 13) - 0.5) * 60,
                      round: seededRandom(index * 41 + 17) > 0.6,
                  })),
        [reduceMotion],
    );

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
            {pieces.map((piece) => (
                <m.span
                    key={piece.id}
                    initial={{ top: "-4%", x: 0, opacity: 0, rotate: piece.rotate }}
                    animate={{
                        top: "104%",
                        x: piece.drift,
                        opacity: [0, 1, 1, 0.9, 0],
                        rotate: piece.rotate + piece.spin,
                    }}
                    transition={{ duration: piece.duration, delay: piece.delay, ease: "easeIn" }}
                    className="absolute"
                    style={{
                        left: `${piece.x}%`,
                        width: piece.size,
                        height: piece.round ? piece.size : piece.size * 1.8,
                        backgroundColor: piece.color,
                        borderRadius: piece.round ? "50%" : 1,
                    }}
                />
            ))}
        </div>
    );
}

interface GiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartTest?: () => void;
}

const steps = [
    { title: "登录完成测肤", desc: "获取您的肌智派测肤结果及所属派系形象海报" },
    { title: "分享肌智派形象海报", desc: "发布海报并 @NIHPLOD" },
    { title: "赢取好礼", desc: "参与活动即可获得抽奖机会" },
];

/**
 * 测肤有礼活动弹窗：统一 ResponsiveDialog + shadcn Button
 */
export function GiftModal({ isOpen, onClose, onStartTest }: GiftModalProps) {
    const ctaClassName = cn(
        buttonVariants({ variant: "default", size: "lg" }),
        "w-full max-w-xs",
    );

    return (
        <ResponsiveDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            overlay={<GiftConfetti />}
            title="肌智派送好礼"
            size="lg"
        >
            <div className="mb-4 flex justify-center">
                <Image
                    src="/NIHPLOD-logo.svg"
                    alt="NIHPLOD"
                    width={136}
                    height={34}
                    className="h-[34px] w-auto object-contain"
                />
            </div>

            <div className="relative mb-8 flex justify-center">
                <div
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-1/2 h-24 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gold/15 blur-3xl sm:h-28 sm:w-44"
                />
                <Image
                    src="/images/gift-package.webp"
                    alt=""
                    aria-hidden="true"
                    width={1195}
                    height={1002}
                    className="relative h-20 w-auto object-contain sm:h-24"
                />
            </div>

            <div className="mx-auto mb-8 w-full max-w-sm rounded-lg border bg-muted/30 p-4">
                <div className="divide-y">
                    {steps.map((item, index) => (
                        <div
                            key={item.title}
                            className="flex gap-3.5 py-4 first:pt-0 last:pb-0"
                        >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-medium">
                                    {item.title}
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {item.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mx-auto mb-6 flex w-full max-w-xs justify-center">
                {onStartTest ? (
                    <Button
                        type="button"
                        size="lg"
                        onClick={onStartTest}
                        rightIcon={<ArrowRight />}
                        className="w-full max-w-xs"
                    >
                        开始测肤
                    </Button>
                ) : (
                    <Link href="/" className={ctaClassName}>
                        开始测肤
                        <ArrowRight />
                    </Link>
                )}
            </div>

            <p className="border-t pt-5 text-center text-xs leading-relaxed text-muted-foreground">
                具体活动时间、奖品与规则以 NIHPLOD 官方媒体账号发布的实际活动内容为准
            </p>
        </ResponsiveDialog>
    );
}
