"use client";

import { LazyMotion, domAnimation } from "framer-motion";

export default function AdvisorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <LazyMotion features={domAnimation}>
            <div className="w-full min-h-screen">
                {children}
            </div>
        </LazyMotion>
    );
}
