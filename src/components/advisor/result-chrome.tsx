"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { SKIN_STATE_LABELS } from "@/lib/skin-state";

// 两页切换 tab：样式对齐主站用户中心「安全中心」的分段标签（胶囊容器 + 选中浅底）
const RESULT_PAGE_TABS = [
    { index: 0 as const, label: "测肤证书" },
    { index: 1 as const, label: "完整报告" },
];

export function ResultPageTabs({ pageIndex, onSwitchPage }: { pageIndex: 0 | 1; onSwitchPage: (idx: 0 | 1) => void }) {
    return (
        <div
            role="tablist"
            aria-label="报告页面切换"
            className="inline-flex rounded-full border border-stone-200 bg-white/40 p-1"
        >
            {RESULT_PAGE_TABS.map(({ index, label }) => (
                <button
                    key={label}
                    id={`result-tab-${index}`}
                    role="tab"
                    aria-selected={pageIndex === index}
                    aria-controls={`result-panel-${index}`}
                    tabIndex={pageIndex === index ? 0 : -1}
                    onClick={() => { if (pageIndex !== index) onSwitchPage(index); }}
                    onKeyDown={(e) => {
                        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                        e.preventDefault();
                        const next = e.key === "ArrowRight" ? 1 : 0;
                        onSwitchPage(next as 0 | 1);
                        requestAnimationFrame(() => {
                            document.getElementById(`result-tab-${next}`)?.focus();
                        });
                    }}
                    className={`rounded-full px-4 py-2 text-xs transition-colors active:opacity-70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-charcoal)]/40 focus-visible:ring-offset-1 ${
                        pageIndex === index
                            ? "bg-[var(--color-brand-charcoal)]/10 font-medium text-[var(--color-brand-charcoal)]"
                            : "text-stone-500 hover:text-stone-800"
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

// 两页版式共享页脚：第一行 = 版权 + 备案链接，第二行 = AI 声明（证书面/报告面共用）
// simple 变体（证书面桌面端）：不要备案链接，版权与 AI 声明合并为一行
export function ResultFooter({ simple = false }: { simple?: boolean }) {
    if (simple) {
        return (
            <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-[11px] font-light tracking-[0.12em] text-brand-charcoal/65">
                <span suppressHydrationWarning>© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</span>
                <span aria-hidden="true" className="hidden sm:inline">|</span>
                <p>*AI 图像分析结果仅供参考，不构成医疗诊断、治疗建议或处方</p>
            </div>
        );
    }
    return (
        <div className="text-center flex flex-col items-center gap-2">
            <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-[11px] font-light tracking-[0.12em] text-brand-charcoal/65">
                <span suppressHydrationWarning>© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</span>
                <span aria-hidden="true" className="hidden sm:inline">|</span>
                <a
                    href="https://beian.miit.gov.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-brand-charcoal/70"
                >
                    沪ICP备2026014764号-1
                </a>
                <span aria-hidden="true" className="hidden sm:inline">|</span>
                <a
                    href="http://www.beian.gov.cn/portal/registerSystemInfo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 transition-colors hover:text-brand-charcoal/70"
                >
                    <Image src="/images/beian.webp" alt="" width={12} height={12} className="shrink-0 opacity-80" />
                    <span>沪公网安备31010702010178号</span>
                </a>
            </div>
            <p className="text-[11px] font-light tracking-[0.12em] text-brand-charcoal/65">
                *AI 图像分析结果仅供参考，不构成医疗诊断、治疗建议或处方。如有皮肤疾病或健康问题，请咨询专业皮肤科医生。
            </p>
        </div>
    );
}

// 两页版式共享页头：归属标题 + 拍摄时肌肤状态标签 + 两页切换 tab（logo 已上移到固定顶部栏）
export function ResultHeader({
    nickname,
    skinStateValue,
    pageIndex,
    onSwitchPage,
}: {
    nickname: string;
    skinStateValue?: string | null;
    pageIndex: 0 | 1;
    onSwitchPage: (idx: 0 | 1) => void;
}) {
    const skinStateLabel = skinStateValue ? SKIN_STATE_LABELS[skinStateValue] : undefined;

    return (
        // 顶部间距：固定顶栏（76/84px）下缘到标题的初始留白，比原 pt-6/8 各加大 16px
        <div className="w-full flex flex-col items-center pt-10 lg:pt-12 pb-4 lg:pb-5">
            {/* 状态标签属于标题一体：紧跟标题文字同行参与布局（整体居中） */}
            <h1 className="mt-0 mb-4 lg:mb-5 text-base lg:text-lg text-[var(--color-brand-cocoa)] font-medium tracking-wide flex flex-wrap items-center justify-center gap-2.5">
                <Sparkles className="w-4 h-4 lg:w-5 lg:h-5" />
                {nickname} 的专属肌智派在线测肤报告
                {skinStateLabel && (
                    <span className="inline-flex h-[22px] px-2 items-center justify-center rounded-full border border-[var(--color-brand-charcoal)]/15 bg-transparent text-[11px] font-bold text-[var(--color-brand-cocoa)] whitespace-nowrap">
                        {skinStateLabel}
                    </span>
                )}
            </h1>
            {/* 两页切换 tab：与标题、与下方卡片保持同一间距
                （标题 mb-4/5 == 页头 pb-4/5，tab 自身不再带下边距） */}
            <ResultPageTabs pageIndex={pageIndex} onSwitchPage={onSwitchPage} />
        </div>
    );
}
