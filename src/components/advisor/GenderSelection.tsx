"use client";

import { m } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface GenderSelectionProps {
    onSelect: (gender: "female" | "male") => void;
}

export function GenderSelection({ onSelect }: GenderSelectionProps) {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="flex w-full flex-col items-center">
            <m.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 text-center"
            >
                <span className="mb-3 inline-block rounded-full bg-[#3D4430]/5 px-4 py-1.5 text-xs font-medium tracking-wider text-[#3D4430]">
                    第一步
                </span>
                <h2 className="font-serif text-2xl text-[#1A1A1A]">
                    为了提供更精准的建议
                </h2>
                <p className="mt-2 text-sm text-[#5E5E5E]">
                    请选择您的适用性别，我们将为您定制专属问卷
                </p>
            </m.div>

            <m.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid w-full gap-4 sm:grid-cols-2"
            >
                <m.button
                    variants={item}
                    onClick={() => onSelect("female")}
                    className="glass-premium group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/40 p-8 text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/50 text-4xl shadow-sm transition-transform group-hover:scale-110">
                        👩
                    </div>
                    <h3 className="mb-1 font-serif text-xl font-medium text-[#1A1A1A]">女性</h3>
                    <p className="text-xs tracking-widest text-[#5E5E5E] uppercase opacity-60">Female</p>

                    <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none" />
                    <div className="absolute right-6 top-6 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A1A1A] text-white shadow-md">
                            <Check className="h-4 w-4" />
                        </div>
                    </div>
                </m.button>

                <m.button
                    variants={item}
                    onClick={() => onSelect("male")}
                    className="glass-premium group relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/40 p-8 text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/50 text-4xl shadow-sm transition-transform group-hover:scale-110">
                        👨
                    </div>
                    <h3 className="mb-1 font-serif text-xl font-medium text-[#1A1A1A]">男性</h3>
                    <p className="text-xs tracking-widest text-[#5E5E5E] uppercase opacity-60">Male</p>

                    <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none" />
                    <div className="absolute right-6 top-6 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A1A1A] text-white shadow-md">
                            <Check className="h-4 w-4" />
                        </div>
                    </div>
                </m.button>
            </m.div>

            <m.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 text-xs text-[#3D4430]/40"
            >
                * 不同性别的皮肤生理特征存在差异，区分分析更科学
            </m.p>
        </div>
    );
}
