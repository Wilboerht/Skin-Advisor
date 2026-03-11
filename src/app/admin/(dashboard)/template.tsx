"use client";

import { motion } from "framer-motion";

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ 
                duration: 0.8, 
                ease: [0.23, 1, 0.32, 1], // Custom overshoot-less spring-like curve
                opacity: { duration: 0.6 },
                filter: { duration: 1 }
            }}
        >
            {children}
        </motion.div>
    );
}
