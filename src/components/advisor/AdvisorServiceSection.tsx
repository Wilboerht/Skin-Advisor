"use client";

import { useState } from "react";
import Image from "next/image";
import { m } from "framer-motion";
import { ArrowRight, MessageCircleHeart, QrCode, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
    ADVISOR_MEMBER_LEVELS,
    ADVISOR_QR_SRC,
    LEVEL_LABELS,
} from "@/components/website/AdvisorContactModal";

interface AdvisorServiceSectionProps {
    /** 未登录时点击登录按钮：由父级打开登录弹窗 */
    onLogin?: () => void;
    className?: string;
}

/** 各会员等级的顾问服务描述（银卡及以上可扫码添加顾问，服务深度随等级递进） */
const LEVEL_SERVICE: Record<string, { title: string; desc: string }> = {
    SILVER: { title: "专属 AI 护肤顾问", desc: "报告深度解读 · 日常护理答疑" },
    GOLD: { title: "专属顾问 · 优先响应", desc: "报告深度解读 · 一对一护理建议" },
    ADVANCED: { title: "专属顾问 · 优先响应", desc: "报告深度解读 · 一对一护理建议" },
    DIAMOND: { title: "专属顾问 · 一对一深度服务", desc: "报告解读 · 方案定制 · 长期陪伴" },
};

/**
 * AdvisorServiceSection — 结果页「专属护肤顾问服务」板块（位于产品推荐之下）。
 * 会员等级分治与 Dock「专属顾问」弹层一致：
 * 未登录 → 登录引导；普通会员 → 升级引导；银卡及以上 → 对应等级服务 + 顾问二维码。
 */
export function AdvisorServiceSection({ onLogin, className }: AdvisorServiceSectionProps) {
    const { user } = useAuth();
    // 二维码素材缺失时降级为占位框（与 AdvisorContactModal 同一素材、同一兜底策略）
    const [qrFailed, setQrFailed] = useState(false);

    const level = user?.membershipLevel ?? "";
    const hasAccess = !!user && ADVISOR_MEMBER_LEVELS.has(level);
    const service = LEVEL_SERVICE[level] ?? LEVEL_SERVICE.SILVER;

    return (
        <section className={cn("relative w-full", className)}>
            <m.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center pt-6 lg:pt-10 mb-6"
            >
                <h2 className="text-lg lg:text-2xl font-bold text-brand-espresso tracking-wide">
                    专属护肤顾问服务
                </h2>
                <p className="text-xs lg:text-sm text-[#8c7a6b] mt-2">
                    让本次诊断不止于一份报告
                </p>
            </m.div>

            <div className="mx-auto w-full max-w-xl">
                {!user ? (
                    /* 未登录：登录引导 */
                    <div className="rounded-3xl border border-brand-charcoal/[0.08] bg-[#FCFAF4] p-6 md:p-8 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-brand-charcoal/[0.04] flex items-center justify-center mb-4">
                            <Sparkles className="w-5 h-5 text-brand-charcoal/65" strokeWidth={1.4} />
                        </div>
                        <h3 className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-2">
                            登录后查看您的专属顾问服务
                        </h3>
                        <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] mb-6">
                            报告解读、护理方案与产品搭配的一对一建议
                        </p>
                        {onLogin && (
                            <button
                                type="button"
                                onClick={onLogin}
                                className="group inline-flex items-center justify-center gap-2 h-11 px-8 rounded-full border border-[#00263E]/25 bg-[#00263E]/[0.08] backdrop-blur-md text-[#00263E] text-[13px] font-normal tracking-[0.08em] transition-colors duration-300 hover:bg-[#00263E]/[0.12] hover:border-[#00263E]/40 cursor-pointer"
                            >
                                <span>立即登录</span>
                                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                            </button>
                        )}
                    </div>
                ) : hasAccess ? (
                    /* 银卡及以上：对应等级服务 + 顾问二维码 */
                    <div className="rounded-3xl border border-brand-charcoal/[0.08] bg-[#FCFAF4] p-6 md:p-8 flex flex-col items-center text-center">
                        <span className="inline-flex h-[26px] px-3 items-center rounded-full border border-[var(--color-brand-cocoa)]/[0.3] bg-[var(--color-brand-cocoa)]/[0.06] text-[11px] font-light text-[var(--color-brand-cocoa)] tracking-[0.04em] mb-4">
                            {LEVEL_LABELS[level] || "会员"} · 已解锁
                        </span>
                        <div className="w-12 h-12 rounded-full bg-brand-charcoal/[0.04] flex items-center justify-center mb-4">
                            <MessageCircleHeart className="w-5 h-5 text-brand-charcoal/65" strokeWidth={1.4} />
                        </div>
                        <h3 className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-2">
                            {service.title}
                        </h3>
                        <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] mb-6">
                            {service.desc}
                            <br />
                            微信扫码添加顾问，带上本次报告直接聊
                        </p>
                        <div className="w-full max-w-[200px] rounded-2xl border border-brand-charcoal/[0.08] bg-white p-3">
                            {qrFailed ? (
                                <div className="aspect-square w-full rounded-xl border border-dashed border-brand-charcoal/20 bg-brand-charcoal/[0.02] flex flex-col items-center justify-center text-brand-charcoal/45">
                                    <QrCode className="w-10 h-10 mb-2" strokeWidth={1.25} />
                                    <p className="text-[12px] font-light tracking-[0.04em]">二维码占位</p>
                                </div>
                            ) : (
                                <Image
                                    src={ADVISOR_QR_SRC}
                                    alt="专属 AI 护肤顾问二维码"
                                    width={200}
                                    height={200}
                                    unoptimized
                                    className="w-full h-auto rounded-xl"
                                    onError={() => setQrFailed(true)}
                                />
                            )}
                            <p className="mt-3 mb-1 text-center text-[12px] text-brand-charcoal/60 font-light tracking-[0.05em]">
                                微信扫码添加
                            </p>
                        </div>
                    </div>
                ) : (
                    /* 普通会员：升级引导 */
                    <div className="rounded-3xl border border-brand-charcoal/[0.08] bg-[#FCFAF4] p-6 md:p-8 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-brand-charcoal/[0.04] flex items-center justify-center mb-4">
                            <Sparkles className="w-5 h-5 text-brand-charcoal/65" strokeWidth={1.4} />
                        </div>
                        <h3 className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-2">
                            专属 AI 护肤顾问
                        </h3>
                        <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] mb-5">
                            银卡及以上会员可添加专属 AI 护肤顾问
                            <br />
                            获得报告解读、护理方案与产品搭配的一对一建议
                        </p>
                        <span className="inline-flex h-[26px] px-3 items-center rounded-full border border-brand-charcoal/[0.12] text-[11px] font-light text-brand-charcoal/55 tracking-[0.04em] mb-5">
                            当前等级 · {LEVEL_LABELS[level] || "普通会员"}
                        </span>
                        <div className="w-full rounded-2xl border border-[var(--color-brand-cocoa)]/20 bg-[var(--color-brand-cocoa)]/[0.04] px-5 py-4">
                            <p className="text-[13px] text-[var(--color-brand-cocoa)] font-light tracking-[0.06em] leading-relaxed">
                                升级银卡及以上会员即可解锁
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
