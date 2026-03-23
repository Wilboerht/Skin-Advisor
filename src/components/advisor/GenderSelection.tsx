"use client";

import { m } from "framer-motion";
import { Venus, Mars } from "lucide-react";

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
                    whileHover={{ y: -6 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ 
                        transform: "translateZ(0)",
                        backfaceVisibility: "hidden", 
                        WebkitBackfaceVisibility: "hidden",
                        perspective: "1000px"
                    }}
                    className="group relative flex items-center gap-5 rounded-[1.5rem] border border-white/60 bg-[#F0EDE1]/55 px-7 py-6 text-left backdrop-blur-md transition-all duration-300 hover:border-[#8B7355]/40 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)]"
                >
                    <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none rounded-[1.5rem]" />
                    
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white to-[#F6F1EF] shadow-[inset_0_2px_8px_rgba(183,149,167,0.1)] border border-white transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[#B795A7]/5">
                        <Venus className="w-8 h-8 text-[#B795A7]" strokeWidth={1.5} />
                    </div>

                    <div className="flex-1 space-y-0.5">
                        <h3 className="text-xl font-serif font-medium text-[#1A1A1A]">女性</h3>
                        <p className="text-[9px] tracking-[0.15em] font-light text-[#5E5E5E] uppercase opacity-60">Female</p>
                    </div>
                </m.button>

                <m.button
                    variants={item}
                    onClick={() => onSelect("male")}
                    whileHover={{ y: -6 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ 
                        transform: "translateZ(0)",
                        backfaceVisibility: "hidden", 
                        WebkitBackfaceVisibility: "hidden",
                        perspective: "1000px"
                    }}
                    className="group relative flex items-center gap-5 rounded-[1.5rem] border border-white/60 bg-[#F0EDE1]/55 px-7 py-6 text-left backdrop-blur-md transition-all duration-300 hover:border-[#8B7355]/40 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)]"
                >
                    <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none rounded-[1.5rem]" />
                    
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white to-[#F0F2F4] shadow-[inset_0_2px_8px_rgba(94,108,117,0.1)] border border-white transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[#5E6C75]/5">
                        <Mars className="w-8 h-8 text-[#5E6C75]" strokeWidth={1.5} />
                    </div>

                    <div className="flex-1 space-y-0.5">
                        <h3 className="text-xl font-serif font-medium text-[#1A1A1A]">男性</h3>
                        <p className="text-[9px] tracking-[0.15em] font-light text-[#5E5E5E] uppercase opacity-60">Male</p>
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
