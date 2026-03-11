"use client";

import { motion } from "framer-motion";

export default function Loading() {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FDFBF7]/30 backdrop-blur-md">
            <div className="relative">
                {/* Outer Glow */}
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.6, 0.3]
                    }}
                    transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute -inset-10 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-3xl rounded-full"
                />
                
                {/* Liquid Spinner */}
                <div className="relative h-16 w-16">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ 
                            duration: 1.5, 
                            repeat: Infinity, 
                            ease: "linear" 
                        }}
                        className="h-full w-full rounded-full border-4 border-slate-900/5 border-t-slate-900 shadow-sm"
                    />
                    
                    {/* Inner Pulsing Dot */}
                    <motion.div
                        animate={{ 
                            scale: [0.8, 1.1, 0.8],
                            opacity: [0.5, 1, 0.5]
                        }}
                        transition={{ 
                            duration: 1,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 bg-slate-900 rounded-full"
                    />
                </div>
            </div>
            
            <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]"
            >
                Loading NIHPLOD Experience
            </motion.p>
        </div>
    );
}
