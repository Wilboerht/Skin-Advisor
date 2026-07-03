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
                className="mb-8 sm:mb-10 text-center font-serif text-2xl md:text-3xl text-[#1A1A1A]"
            >
                开始之前，请选择您的性别
            </m.h2>

            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 w-full">
                <m.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative w-[150px] h-[150px] sm:w-auto sm:h-auto sm:flex-[4] sm:aspect-square flex-shrink-0"
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
                    className="grid w-full sm:flex-[6] gap-3 sm:gap-5"
                >
                <m.button
                    variants={item}
                    onClick={() => onSelect("female")}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ 
                        transform: "translateZ(0)",
                        backfaceVisibility: "hidden", 
                        WebkitBackfaceVisibility: "hidden",
                        perspective: "1000px"
                    }}
                    className="group relative flex flex-row items-center gap-4 rounded-xl border border-[#3D4430]/15 bg-[#F0EDE1]/60 px-5 sm:px-8 py-5 sm:py-6 text-left backdrop-blur-md transition-all duration-300 hover:border-[#B795A7]/40 hover:bg-[#FDF8FA]/80 hover:shadow-[0_16px_40px_-8px_rgba(183,149,167,0.12)]"
                >
                    <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none rounded-xl" />
                    
                    <div className="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white to-[#F6F1EF] shadow-[inset_0_2px_8px_rgba(183,149,167,0.12)] border border-[#3D4430]/10 transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_8px_24px_-4px_rgba(183,149,167,0.18)]">
                        <Venus className="w-7 h-7 sm:w-9 sm:h-9 text-[#B795A7]" strokeWidth={1.5} />
                    </div>

                    <div className="space-y-0.5 sm:space-y-1">
                        <h3 className="text-lg sm:text-xl font-serif font-medium text-[#1A1A1A]">女性</h3>
                        <p className="text-[10px] sm:text-[11px] tracking-[0.15em] font-light text-[#5E5E5E]/80 uppercase">Female</p>
                    </div>
                </m.button>

                <m.button
                    variants={item}
                    onClick={() => onSelect("male")}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ 
                        transform: "translateZ(0)",
                        backfaceVisibility: "hidden", 
                        WebkitBackfaceVisibility: "hidden",
                        perspective: "1000px"
                    }}
                    className="group relative flex flex-row items-center gap-4 rounded-xl border border-[#3D4430]/15 bg-[#F0EDE1]/60 px-5 sm:px-8 py-5 sm:py-6 text-left backdrop-blur-md transition-all duration-300 hover:border-[#5E6C75]/40 hover:bg-[#F8FAFB]/80 hover:shadow-[0_16px_40px_-8px_rgba(94,108,117,0.12)]"
                >
                    <div className="texture-overlay absolute inset-0 opacity-[0.03] pointer-events-none rounded-xl" />
                    
                    <div className="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white to-[#F0F2F4] shadow-[inset_0_2px_8px_rgba(94,108,117,0.12)] border border-[#3D4430]/10 transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_8px_24px_-4px_rgba(94,108,117,0.18)]">
                        <Mars className="w-7 h-7 sm:w-9 sm:h-9 text-[#5E6C75]" strokeWidth={1.5} />
                    </div>

                    <div className="space-y-0.5 sm:space-y-1">
                        <h3 className="text-lg sm:text-xl font-serif font-medium text-[#1A1A1A]">男性</h3>
                        <p className="text-[10px] sm:text-[11px] tracking-[0.15em] font-light text-[#5E5E5E]/80 uppercase">Male</p>
                    </div>
                </m.button>
            </m.div>
        </div>
        </div>
    );
}
