"use client";

import { m } from "framer-motion";
import { Venus, Mars } from "lucide-react";

interface GenderSelectionProps {
    onSelect: (gender: "female" | "male") => void;
    selectedGender?: "female" | "male" | null;
}

export function GenderSelection({ onSelect, selectedGender }: GenderSelectionProps) {
    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="flex w-full flex-col items-center -mt-8 sm:mt-0">
            <m.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 text-center font-serif font-light text-lg md:text-2xl text-brand-charcoal tracking-[0.02em]"
            >
                开始之前，请选择您的性别
            </m.h2>

            <div className="grid w-full max-w-md sm:max-w-lg sm:grid-cols-2 gap-2 sm:gap-5" role="radiogroup" aria-label="选择性别">
                <m.button
                    variants={item}
                    onClick={() => onSelect("female")}
                    whileTap={{ scale: 0.98 }}
                    role="radio"
                    aria-checked={selectedGender === "female"}
                    aria-label="女性"
                    className="group flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:gap-5 rounded-xl border border-brand-charcoal/12 bg-white px-5 sm:px-12 py-5 sm:py-12 text-left sm:text-center transition-all duration-300 hover:border-brand-charcoal/35 hover:shadow-[0_8px_24px_rgba(0,38,62,0.08)] touch-manipulation"
                >
                    <div className="flex h-12 w-12 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-full bg-brand-charcoal/[0.06] transition-colors duration-300 group-hover:bg-brand-charcoal/[0.10]">
                        <Venus className="h-6 w-6 sm:h-14 sm:w-14 text-brand-charcoal/70" strokeWidth={1.5} />
                    </div>

                    <div>
                        <h3 className="text-lg sm:text-2xl font-serif font-light text-brand-charcoal">女性</h3>
                    </div>
                </m.button>

                <m.button
                    variants={item}
                    onClick={() => onSelect("male")}
                    whileTap={{ scale: 0.98 }}
                    role="radio"
                    aria-checked={selectedGender === "male"}
                    aria-label="男性"
                    className="group flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:gap-5 rounded-xl border border-brand-charcoal/12 bg-white px-5 sm:px-12 py-5 sm:py-12 text-left sm:text-center transition-all duration-300 hover:border-brand-charcoal/35 hover:shadow-[0_8px_24px_rgba(0,38,62,0.08)] touch-manipulation"
                >
                    <div className="flex h-12 w-12 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-full bg-brand-charcoal/[0.06] transition-colors duration-300 group-hover:bg-brand-charcoal/[0.10]">
                        <Mars className="h-6 w-6 sm:h-14 sm:w-14 text-brand-charcoal/70" strokeWidth={1.5} />
                    </div>

                    <div>
                        <h3 className="text-lg sm:text-2xl font-serif font-light text-brand-charcoal">男性</h3>
                    </div>
                </m.button>
            </div>
        </div>
    );
}
