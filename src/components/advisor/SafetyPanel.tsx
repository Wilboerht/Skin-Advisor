"use client";

import { AlertTriangle, FlaskConical, ShieldCheck, Stethoscope, Sun, TestTube } from "lucide-react";
import type { SafetyNotes } from "@/lib/report-safety";

interface SafetyPanelProps {
    notes?: SafetyNotes;
}

function Section({
    icon,
    title,
    items,
}: {
    icon: React.ReactNode;
    title: string;
    items: string[];
}) {
    if (items.length === 0) return null;
    return (
        <div className="rounded-xl border border-[var(--color-brand-espresso)]/10 bg-white/65 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-brand-espresso)]">
                {icon}
                {title}
            </p>
            <ul className="space-y-1.5">
                {items.map((item, index) => (
                    <li key={`${title}-${index}`} className="flex gap-1.5 text-[12px] leading-[1.7] text-[var(--color-brand-cocoa)]">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--color-brand-taupe)]" />
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * 安全与成分：过敏/孕期排除项、活性成分、叠加禁忌、建立耐受、防晒、就医边界。
 * 数据由服务端确定性生成，不展示原始过敏史/孕期字段。
 */
export function SafetyPanel({ notes }: SafetyPanelProps) {
    if (!notes) return null;
    const hasAny = notes.excluded.length > 0
        || notes.actives.length > 0
        || notes.conflicts.length > 0
        || !!notes.patchTest
        || !!notes.sunProtection
        || notes.whenToSeeDoctor.length > 0;
    if (!hasAny) return null;

    return (
        <section aria-label="安全与成分">
            <h4 className="mb-3 border-b border-[var(--color-brand-espresso)]/20 pb-2 text-base font-medium text-[var(--color-brand-espresso)]">
                安全与成分 <span className="text-xs lg:text-base">（Safety & Ingredients）</span>
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
                <Section
                    icon={<ShieldCheck className="h-3.5 w-3.5 text-[#3d7a4d]" strokeWidth={1.8} />}
                    title="已为你避开"
                    items={notes.excluded}
                />
                <Section
                    icon={<FlaskConical className="h-3.5 w-3.5 text-[#8B6914]" strokeWidth={1.8} />}
                    title="当前方案中的活性成分"
                    items={notes.actives}
                />
                <Section
                    icon={<AlertTriangle className="h-3.5 w-3.5 text-[#b06a3b]" strokeWidth={1.8} />}
                    title="叠加与使用禁忌"
                    items={notes.conflicts}
                />
                <Section
                    icon={<TestTube className="h-3.5 w-3.5 text-[#5c6f3d]" strokeWidth={1.8} />}
                    title="建立耐受 / 斑贴测试"
                    items={notes.patchTest ? [notes.patchTest] : []}
                />
                <Section
                    icon={<Sun className="h-3.5 w-3.5 text-[#8B6914]" strokeWidth={1.8} />}
                    title="防晒要求"
                    items={notes.sunProtection ? [notes.sunProtection] : []}
                />
                <Section
                    icon={<Stethoscope className="h-3.5 w-3.5 text-[#c45a4a]" strokeWidth={1.8} />}
                    title="什么时候需要看医生"
                    items={notes.whenToSeeDoctor}
                />
            </div>
        </section>
    );
}
