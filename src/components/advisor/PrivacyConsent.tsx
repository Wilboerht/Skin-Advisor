"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { Shield, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORAGE_KEYS } from "@/lib/storage-keys";

interface PrivacyConsentProps {
    onConsent: () => void;
}

export const CONSENT_VERSION = "2025-06-01";

export function PrivacyConsent({ onConsent }: PrivacyConsentProps) {
    const [agreed, setAgreed] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div className="flex w-full flex-col items-center">
            <m.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 sm:mb-8 text-center"
            >
                <span className="mb-3 inline-block rounded-md bg-[#3D4430]/5 px-4 py-1.5 text-[11px] font-medium tracking-wider text-[#3D4430]">
                    开始之前
                </span>
                <h2 className="font-serif text-2xl md:text-3xl text-[#1A1A1A]">
                    您的隐私对我们至关重要
                </h2>
                <p className="mt-2 text-sm text-[#5E5E5E] font-light max-w-md mx-auto">
                    为了提供精准的 AI 肤质分析，我们需要采集您的面部照片和问卷信息。
                    请阅读并确认以下隐私条款。
                </p>
            </m.div>

            <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full max-w-lg space-y-4"
            >
                {/* 核心摘要卡片 */}
                <div className="rounded-xl border border-[#3D4430]/10 bg-white/60 backdrop-blur-md p-5 sm:p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3D4430]/5">
                            <Shield className="h-5 w-5 text-[#3D4430]" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-[#1A1A1A]">数据收集范围</h3>
                            <p className="mt-1 text-xs text-[#5E5E5E] leading-relaxed">
                                我们收集您的面部照片（仅用于 AI 分析，不用于其他目的）、问卷答案、设备信息（用于优化体验）以及分析结果。
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-[#3D4430]/10" />

                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3D4430]/5">
                            <Shield className="h-5 w-5 text-[#3D4430]" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-[#1A1A1A]">数据存储与安全</h3>
                            <p className="mt-1 text-xs text-[#5E5E5E] leading-relaxed">
                                您的照片和分析结果会被加密存储，90 天后自动删除。我们不会将您的数据出售给第三方。
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-[#3D4430]/10" />

                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3D4430]/5">
                            <Shield className="h-5 w-5 text-[#3D4430]" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-[#1A1A1A]">AI 分析说明</h3>
                            <p className="mt-1 text-xs text-[#5E5E5E] leading-relaxed">
                                您的照片将发送至 AI 视觉模型进行肤质分析。分析完成后，照片将立即从 AI 服务商处删除。
                            </p>
                        </div>
                    </div>
                </div>

                {/* 详细条款折叠 */}
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 min-h-[44px] py-2 px-1 -mx-1 text-xs text-[#3D4430]/60 hover:text-[#3D4430] transition-colors mx-auto"
                >
                    <span>{showDetails ? "收起" : "查看完整隐私政策与服务条款"}</span>
                    <ChevronRight
                        size={12}
                        className={cn("transition-transform", showDetails && "rotate-90")}
                    />
                </button>

                {showDetails && (
                    <m.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="rounded-lg border border-[#3D4430]/10 bg-[#F8F7F4] p-4 text-xs text-[#5E5E5E] leading-relaxed space-y-2 max-h-48 overflow-y-auto"
                    >
                        <p>1. 我们尊重并保护所有用户的个人隐私权。</p>
                        <p>2. 面部照片仅用于 AI 肤质分析，不会用于人脸识别训练或其他商业用途。</p>
                        <p>3. 您有权随时要求删除您的个人数据，请联系客服。</p>
                        <p>4. 未经您明确同意，我们不会向第三方共享您的个人身份信息。</p>
                        <p>5. 使用本服务即表示您同意我们的隐私政策和服务条款。</p>
                    </m.div>
                )}

                {/* 同意操作区 */}
                <div className="pt-2 space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className={cn(
                                "h-5 w-5 rounded border transition-all duration-200 flex items-center justify-center shrink-0 mt-0.5",
                                agreed
                                    ? "bg-[#3D4430] border-[#3D4430]"
                                    : "border-[#3D4430]/20 bg-white group-hover:border-[#3D4430]/40"
                            )}>
                                {agreed && (
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                        </div>
                        <span className="text-xs text-[#5E5E5E] leading-relaxed">
                            我已阅读并同意
                            <a href="https://nihplod.cn/privacy" target="_blank" rel="noopener noreferrer" className="text-[#3D4430] underline underline-offset-2 mx-0.5">《隐私政策》</a>
                            和
                            <a href="https://nihplod.cn/terms" target="_blank" rel="noopener noreferrer" className="text-[#3D4430] underline underline-offset-2 mx-0.5">《服务条款》</a>
                            ，了解并同意上述数据收集与使用方式。
                        </span>
                    </label>

                    <button
                        onClick={() => {
                            if (!agreed) return;
                            try {
                                localStorage.setItem(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT, JSON.stringify({
                                    version: CONSENT_VERSION,
                                    consentedAt: new Date().toISOString()
                                }));
                            } catch (e) {
                                console.warn("Failed to save privacy consent", e);
                            }
                            onConsent();
                        }}
                        disabled={!agreed}
                        className={cn(
                            "w-full py-3.5 rounded-xl text-sm font-medium tracking-wide transition-all duration-300",
                            agreed
                                ? "bg-[#1A1A1A] text-white hover:bg-[#333] shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                                : "bg-[#1A1A1A]/10 text-[#1A1A1A]/30 cursor-not-allowed"
                        )}
                    >
                        同意并继续
                    </button>
                </div>
            </m.div>
        </div>
    );
}

export function hasPrivacyConsent(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT);
        if (!raw) return false;
        const data = JSON.parse(raw);
        return data.version === CONSENT_VERSION && !!data.consentedAt;
    } catch {
        return false;
    }
}

export function getPrivacyConsentPayload() {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.ADVISOR_PRIVACY_CONSENT);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}
