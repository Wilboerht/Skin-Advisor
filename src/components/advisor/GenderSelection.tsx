"use client";

import { m } from "framer-motion";
import { Venus, Mars } from "lucide-react";

interface GenderSelectionProps {
    onSelect: (gender: "female" | "male") => void;
}

export function GenderSelection({ onSelect }: GenderSelectionProps) {
    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="flex w-full flex-col items-center -mt-8 sm:mt-0">
            <m.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 text-center font-serif text-2xl md:text-3xl text-[#1A1A1A]"
            >
                开始之前，请选择您的性别
            </m.h2>

            <div className="grid w-full max-w-md sm:max-w-lg sm:grid-cols-2 gap-2 sm:gap-5">
                <m.button
                    variants={item}
                    onClick={() => onSelect("female")}
                    whileTap={{ scale: 0.98 }}
                    className="group flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:gap-5 rounded-xl border border-[#E8E2D9] bg-white px-5 sm:px-12 py-5 sm:py-12 text-left sm:text-center transition-[border-color,background-color,box-shadow] duration-300 hover:border-[#C9A86C] hover:shadow-sm touch-manipulation"
                >
                    <div className="flex h-12 w-12 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-full bg-[#A0784C] transition-colors duration-300 group-hover:bg-[#8B5E2A]">
                        <Venus className="h-6 w-6 sm:h-14 sm:w-14 text-white" strokeWidth={2} />
                    </div>

                    <div>
                        <h3 className="text-lg sm:text-2xl font-serif font-medium text-[#1A1A1A]">女性</h3>
                    </div>
                </m.button>

                <m.button
                    variants={item}
                    onClick={() => onSelect("male")}
                    whileTap={{ scale: 0.98 }}
                    className="group flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:gap-5 rounded-xl border border-[#E8E2D9] bg-white px-5 sm:px-12 py-5 sm:py-12 text-left sm:text-center transition-[border-color,background-color,box-shadow] duration-300 hover:border-[#1B3A5C]/40 hover:shadow-sm touch-manipulation"
                >
                    <div className="flex h-12 w-12 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-full bg-[#1B3A5C] transition-colors duration-300 group-hover:bg-[#142945]">
                        <Mars className="h-6 w-6 sm:h-14 sm:w-14 text-white" strokeWidth={2} />
                    </div>

                    <div>
                        <h3 className="text-lg sm:text-2xl font-serif font-medium text-[#1A1A1A]">男性</h3>
                    </div>
                </m.button>
            </div>
        </div>
    );
}
