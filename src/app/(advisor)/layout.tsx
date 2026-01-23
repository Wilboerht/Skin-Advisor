"use client";

import { LazyMotion, domAnimation } from "framer-motion";

export default function AdvisorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <LazyMotion features={domAnimation}>
            <div className="min-h-screen bg-brand-cream">
                {/* 简单的顶部导航 */}
                <header className="fixed top-0 z-50 w-full bg-white/80 px-4 py-3 backdrop-blur-md">
                    <div className="mx-auto flex max-w-md items-center justify-between">
                        <div className="text-sm font-medium text-brand-charcoal">AI Skincare</div>
                        <div className="text-xs text-brand-charcoal/50">Beta</div>
                    </div>
                </header>

                <main className="mx-auto max-w-md pt-16 pb-10">
                    {children}
                </main>
            </div>
        </LazyMotion>
    );
}
