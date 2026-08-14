"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, MessageCircle, QrCode } from "lucide-react";
import { ADVISOR_WECOM_LINK } from "@/lib/advisor-report-text";

interface AdvisorConsultCardProps {
    reportText: string;
    advisorLink?: string;
    onCopied?: () => void;
    onOpenAdvisor?: () => void;
    onOpenQr?: () => void;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
    // 优先走现代 Clipboard API（微信内置浏览器可能拒绝，回退到 execCommand）
    try {
        if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through
    }
    try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}

const STEPS = [
    { label: "复制报告摘要" },
    { label: "打开护肤顾问" },
    { label: "粘贴发送，顾问据此定制方案" },
];

export default function AdvisorConsultCard({
    reportText,
    advisorLink = ADVISOR_WECOM_LINK,
    onCopied,
    onOpenAdvisor,
    onOpenQr,
}: AdvisorConsultCardProps) {
    const [copied, setCopied] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);

    const handleCopy = async () => {
        if (!reportText) return;
        const ok = await copyTextToClipboard(reportText);
        if (ok) {
            setCopied(true);
            setCopyFailed(false);
            onCopied?.();
            setTimeout(() => setCopied(false), 4000);
        } else {
            setCopyFailed(true);
        }
    };

    return (
        <section
            aria-label="咨询护肤顾问"
            className="w-full mt-12 pt-10 border-t border-brand-charcoal/[0.08]"
        >
            <div className="max-w-[560px] mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
                <h3 className="text-base sm:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em] mb-2">
                    报告看不懂？联系您的专属顾问
                </h3>
                <p className="text-[12px] text-brand-charcoal/50 font-light tracking-[0.08em]">
                    三步让 AI 护肤顾问读懂你的专属报告
                </p>
            </div>

            {/* Three steps */}
            <ol className="space-y-3 mb-6 sm:mb-7">
                {STEPS.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                        <span
                            className={`mt-0.5 w-6 h-6 shrink-0 rounded-full border text-[11px] font-light flex items-center justify-center transition-colors duration-300 ${
                                copied && i === STEPS.length - 1
                                    ? "bg-[#5c4937] border-[#5c4937] text-white"
                                    : "border-brand-charcoal/25 text-brand-charcoal/60"
                            }`}
                            aria-hidden="true"
                        >
                            {copied && i === STEPS.length - 1 ? (
                                <Check className="w-3.5 h-3.5" />
                            ) : (
                                i + 1
                            )}
                        </span>
                        <span className="text-[13px] text-brand-charcoal/70 font-light tracking-[0.04em] leading-6">
                            {step.label}
                        </span>
                    </li>
                ))}
            </ol>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-4">
                <button
                    onClick={handleCopy}
                    disabled={!reportText || copied}
                    className={`inline-flex items-center justify-center gap-2 px-5 sm:px-8 py-2.5 sm:py-3 rounded-full text-[12px] sm:text-[13px] tracking-[0.1em] font-medium transition-colors ${
                        copied
                            ? "bg-[#5c4937]/10 text-[#5c4937] border border-[#5c4937]/20 cursor-default"
                            : "bg-[#5c4937] text-white hover:bg-[#4a3a2c] disabled:opacity-50"
                    }`}
                >
                    {copied ? (
                        <>
                            <Check className="w-4 h-4" />
                            已复制
                        </>
                    ) : (
                        <>
                            <Copy className="w-4 h-4" />
                            复制报告摘要
                        </>
                    )}
                </button>
                <a
                    href={advisorLink}
                    onClick={onOpenAdvisor}
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-8 py-2.5 sm:py-3 rounded-full border border-[#5c4937]/30 text-[#5c4937] text-[12px] sm:text-[13px] tracking-[0.1em] font-medium hover:bg-[#5c4937]/5 transition-colors"
                >
                    <MessageCircle className="w-4 h-4" />
                    打开护肤顾问
                    <ArrowRight className="w-3.5 h-3.5" />
                </a>
            </div>

            {/* Copied hint */}
            {copied && (
                <p className="text-center text-[12px] text-[#5c4937] font-light tracking-[0.06em]">
                    已复制，打开顾问后长按输入框粘贴发送即可
                </p>
            )}

            {/* Copy failed fallback */}
            {copyFailed && !copied && (
                <div className="mt-2">
                    <p className="text-center text-[12px] text-red-600/80 font-light mb-2">
                        自动复制失败，请长按下方文本全选后手动复制
                    </p>
                    <textarea
                        readOnly
                        value={reportText}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full h-28 resize-none rounded-lg border border-brand-charcoal/15 bg-[#FAFAF7] p-3 text-[12px] leading-relaxed text-brand-charcoal/80 font-light focus:outline-none"
                    />
                </div>
            )}

            {/* QR fallback */}
            {onOpenQr && (
                <div className="mt-6 pt-5 border-t border-dashed border-brand-charcoal/[0.08] text-center">
                    <button
                        onClick={onOpenQr}
                        className="inline-flex items-center gap-1.5 text-[12px] text-brand-charcoal/45 tracking-[0.08em] font-light transition-colors hover:text-brand-charcoal/75"
                    >
                        <QrCode className="w-3.5 h-3.5" />
                        也可扫码关注服务号，获取更多定制化服务
                    </button>
                </div>
            )}
            </div>
        </section>
    );
}
