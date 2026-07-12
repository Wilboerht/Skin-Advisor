"use client";

import { useState, useEffect } from "react";
import { m } from "framer-motion";
import Image from "next/image";
import { Venus, Mars } from "lucide-react";

const CHARACTER_TYPES = ["ageless", "combination", "desert", "guardian", "luxury", "minimalist", "oily", "sensitive"] as const;
const CHARACTER_GENDERS = ["female", "male"] as const;

function getRandomCharacterImage() {
    const type = CHARACTER_TYPES[Math.floor(Math.random() * CHARACTER_TYPES.length)];
    const gender = CHARACTER_GENDERS[Math.floor(Math.random() * CHARACTER_GENDERS.length)];
    return `/images/character/${type}/${type}_${gender}.png`;
}

interface GenderSelectionProps {
    onSelect: (gender: "female" | "male") => void;
}

export function GenderSelection({ onSelect }: GenderSelectionProps) {
    const [characterImage, setCharacterImage] = useState("");

    useEffect(() => {
        setCharacterImage(getRandomCharacterImage());
    }, []);
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
            <m.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 sm:mb-10 text-center font-serif text-2xl md:text-3xl text-[#1A1A1A]"
            >
                开始之前，请选择您的性别
            </m.h2>

            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full">
                <m.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative w-[120px] h-[120px] sm:w-auto sm:h-auto sm:flex-[4] sm:aspect-square flex-shrink-0"
                >
                    <Image
                        src={characterImage || "/images/character/luxury/luxury_female.png"}
                        alt=""
                        fill
                        className="object-contain"
                        priority
                    />
                </m.div>

                <m.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid w-full sm:flex-[6] gap-2 sm:gap-5"
                >
                <m.button
                    variants={item}
                    onClick={() => onSelect("female")}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    className="group flex flex-row items-center gap-4 rounded-xl border border-[#E8E2D9] bg-white px-5 sm:px-8 py-4 sm:py-6 text-left transition-[border-color,background-color,box-shadow] duration-300 hover:border-[#C9A86C] hover:shadow-sm touch-manipulation"
                >
                    <div className="flex h-10 w-10 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full bg-[#A0784C]/[0.08] transition-colors duration-300 group-hover:bg-[#A0784C]/[0.12]">
                        <Venus className="w-6 h-6 sm:w-9 sm:h-9 text-[#A0784C]" strokeWidth={1.5} />
                    </div>

                    <div>
                        <h3 className="text-lg sm:text-xl font-serif font-medium text-[#1A1A1A]">女性</h3>
                    </div>
                </m.button>

                <m.button
                    variants={item}
                    onClick={() => onSelect("male")}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    className="group flex flex-row items-center gap-4 rounded-xl border border-[#E8E2D9] bg-white px-5 sm:px-8 py-4 sm:py-6 text-left transition-[border-color,background-color,box-shadow] duration-300 hover:border-[#1B3A5C]/40 hover:shadow-sm touch-manipulation"
                >
                    <div className="flex h-10 w-10 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full bg-[#1B3A5C]/[0.08] transition-colors duration-300 group-hover:bg-[#1B3A5C]/[0.12]">
                        <Mars className="w-6 h-6 sm:w-9 sm:h-9 text-[#1B3A5C]" strokeWidth={1.5} />
                    </div>

                    <div>
                        <h3 className="text-lg sm:text-xl font-serif font-medium text-[#1A1A1A]">男性</h3>
                    </div>
                </m.button>
            </m.div>
        </div>
        </div>
    );
}
