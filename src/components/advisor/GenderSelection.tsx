"use client";

import { m } from "framer-motion";
import Image from "next/image";

interface GenderSelectionProps {
    onSelect: (gender: "female" | "male") => void;
}

export function GenderSelection({ onSelect }: GenderSelectionProps) {
    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="flex w-full flex-col items-center">
            <m.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 pt-8 sm:pt-10 md:pt-6 text-center font-serif text-2xl md:text-3xl text-[#1A1A1A]"
            >
                开始之前，请选择您的性别
            </m.h2>

            <div className="grid w-full max-w-md sm:max-w-lg sm:grid-cols-2 gap-2 sm:gap-5">
                <m.button
                    variants={item}
                    onClick={() => onSelect("female")}
                    whileTap={{ scale: 0.98 }}
                    className="group flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:gap-4 rounded-xl border border-[#E8E2D9] bg-white px-5 sm:px-10 py-5 sm:py-10 text-left sm:text-center transition-[border-color,background-color,box-shadow] duration-300 hover:border-[#C9A86C] hover:shadow-sm touch-manipulation"
                >
                    <div className="relative h-12 w-12 sm:h-24 sm:w-24 shrink-0 rounded-full overflow-hidden bg-[#A0784C]/[0.08] transition-colors duration-300 group-hover:bg-[#A0784C]/[0.12]">
                        <Image src="/images/gender-female.png" alt="女性" fill className="object-cover" />
                    </div>

                    <div>
                        <h3 className="text-lg sm:text-xl font-serif font-medium text-[#1A1A1A]">女性</h3>
                    </div>
                </m.button>

                <m.button
                    variants={item}
                    onClick={() => onSelect("male")}
                    whileTap={{ scale: 0.98 }}
                    className="group flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:gap-4 rounded-xl border border-[#E8E2D9] bg-white px-5 sm:px-10 py-5 sm:py-10 text-left sm:text-center transition-[border-color,background-color,box-shadow] duration-300 hover:border-[#1B3A5C]/40 hover:shadow-sm touch-manipulation"
                >
                    <div className="relative h-12 w-12 sm:h-24 sm:w-24 shrink-0 rounded-full overflow-hidden bg-[#1B3A5C]/[0.08] transition-colors duration-300 group-hover:bg-[#1B3A5C]/[0.12]">
                        <Image src="/images/gender-male.png" alt="男性" fill className="object-cover" />
                    </div>

                    <div>
                        <h3 className="text-lg sm:text-xl font-serif font-medium text-[#1A1A1A]">男性</h3>
                    </div>
                </m.button>
            </div>
        </div>
    );
}
