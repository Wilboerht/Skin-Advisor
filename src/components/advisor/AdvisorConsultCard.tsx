"use client";

import { Fragment, useState } from "react";
import { Check, ChevronRight, Copy, MessageCircle, QrCode } from "lucide-react";
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
    { label: "获取专属方案" },
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
            className="w-full pt-10 border-t border-brand-charcoal/[0.08]"
        >
            <div className="max-w-[560px] mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
                <h3 className="text-[17px] sm:text-lg lg:text-2xl font-bold text-[#3d2f25] tracking-wide mb-2">
                    <span className="relative inline-block">
                        联系您的专属顾问，获取更多专属护肤建议
                        <span className="absolute left-full top-1/2 -translate-y-1/2 ml-1.5 sm:ml-2 inline-flex items-center rounded-full border border-[#C9A86C]/50 bg-[#C9A86C]/15 px-2 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-[0.14em] text-[#8c6b3f] leading-none whitespace-nowrap">
                            FREE
                        </span>
                    </span>
                </h3>
                <p className="text-xs lg:text-sm text-[#8c7a6b]">
                    三步让 AI 护肤顾问读懂你的专属报告
                </p>
            </div>

            {/* Three steps */}
            <ol className="flex flex-col sm:flex-row sm:items-start gap-y-4 mb-6 sm:mb-7">
                {STEPS.map((step, i) => (
                    <Fragment key={i}>
                        <li className="flex sm:flex-none sm:flex-col items-start sm:items-center gap-3 sm:gap-2.5 sm:text-center">
                            <span
                                className={`mt-0.5 sm:mt-0 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[12px] font-semibold transition-colors duration-300 shadow-[0_1px_4px_rgba(92,73,55,0.15)] ${
                                    copied && i === STEPS.length - 1
                                        ? "bg-[#5c4937] border border-[#5c4937] text-white"
                                        : "bg-[#5c4937]/[0.06] border border-[#5c4937]/20 text-[#5c4937]"
                                }`}
                                aria-hidden="true"
                            >
                                {copied && i === STEPS.length - 1 ? (
                                    <Check className="w-3.5 h-3.5" />
                                ) : (
                                    i + 1
                                )}
                            </span>
                            <span className="text-[13px] sm:text-sm text-[#3d2f25]/90 font-medium tracking-[0.03em] leading-6 sm:whitespace-nowrap">
                                {step.label}
                            </span>
                        </li>
                        {i < STEPS.length - 1 && (
                            <span
                                className="hidden sm:flex items-center flex-1 min-w-6 mx-2 shrink-0 self-start sm:mt-[9px]"
                                aria-hidden="true"
                            >
                                <span className="flex-1 h-[1.5px] rounded bg-[#5c4937]/25" />
                                <ChevronRight className="w-3.5 h-3.5 -ml-0.5 text-[#5c4937]/25" strokeWidth={2.5} />
                            </span>
                        )}
                    </Fragment>
                ))}
            </ol>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                    onClick={handleCopy}
                    disabled={!reportText || copied}
                    className={`group flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-5 border text-center transition-all duration-300 ${
                        copied
                            ? "border-[#5c4937]/15 bg-[#F0EDE8] cursor-default"
                            : "border-[#5c4937]/12 bg-[#F5F2ED] hover:border-[#5c4937]/30 hover:bg-[#FAF8F4] hover:shadow-[0_6px_20px_rgba(61,47,37,0.10)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    }`}
                >
                    <span className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-300 ${
                        copied
                            ? "bg-[#5c4937]/10"
                            : "bg-[#5c4937] shadow-[0_2px_8px_rgba(92,73,55,0.35)] group-hover:bg-[#4a3a2c]"
                    }`}>
                        {copied ? (
                            <Check className="w-5 h-5 text-[#5c4937]" />
                        ) : (
                            <Copy className="w-5 h-5 text-white" />
                        )}
                    </span>
                    <span className={`text-[13px] font-semibold tracking-[0.04em] ${copied ? "text-[#5c4937]" : "text-[#3d2f25]"}`}>
                        {copied ? "已复制" : "复制报告摘要"}
                    </span>
                </button>
                <a
                    href={advisorLink}
                    onClick={onOpenAdvisor}
                    className="group flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-5 border border-[#5c4937]/12 bg-[#F5F2ED] text-center transition-all duration-300 hover:border-[#5c4937]/30 hover:bg-[#FAF8F4] hover:shadow-[0_6px_20px_rgba(61,47,37,0.10)] hover:-translate-y-0.5 active:translate-y-0"
                >
                    <span className="w-11 h-11 rounded-full bg-[#5c4937]/10 flex items-center justify-center transition-colors duration-300 group-hover:bg-[#5c4937]/15">
                        <MessageCircle className="w-5 h-5 text-[#5c4937]" />
                    </span>
                    <span className="text-[13px] font-semibold tracking-[0.04em] text-[#3d2f25]">
                        打开护肤顾问
                    </span>
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
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-dashed border-[#8c7a6b]/45 bg-[#8c7a6b]/[0.05] text-[12px] sm:text-[13px] tracking-[0.06em] text-[#7a6552] font-medium transition-all duration-300 hover:text-[#5c4937] hover:border-[#5c4937]/50 hover:bg-[#5c4937]/5"
                    >
                        <QrCode className="w-4 h-4" />
                        也可扫码关注服务号，获取更多定制化服务
                    </button>
                </div>
            )}
            </div>
        </section>
    );
}
