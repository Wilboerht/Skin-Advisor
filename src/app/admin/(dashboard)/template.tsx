"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
    const shouldAnimate = !useReducedMotion();

    const initial = shouldAnimate
        ? { opacity: 0, y: 10, filter: "blur(10px)" }
        : { opacity: 0 };
    const animate = shouldAnimate
        ? { opacity: 1, y: 0, filter: "blur(0px)" }
        : { opacity: 1 };
    const transition = shouldAnimate
        ? ({
            duration: 0.8,
            ease: [0.23, 1, 0.32, 1] as const,
            opacity: { duration: 0.6 },
            filter: { duration: 1 }
          } as const)
        : { duration: 0.3 };

    return (
        <motion.div
            initial={initial}
            animate={animate}
            transition={transition}
        >
            {children}
        </motion.div>
    );
}
