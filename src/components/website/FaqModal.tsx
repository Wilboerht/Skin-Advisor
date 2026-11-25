"use client";

import { faqs } from "@/lib/faq-data";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";

interface FaqModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * FaqModal — 首页“常见问题”入口
 * 统一使用 ResponsiveDialog + 原生 details 手风琴
 */
export function FaqModal({ isOpen, onClose }: FaqModalProps) {
    return (
        <ResponsiveDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="常见问题"
            size="lg"
        >
            <div className="divide-y">
                {faqs.map((faq, index) => (
                    <details key={index} className="group">
                        <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-sm font-medium text-foreground transition-colors hover:text-primary">
                            <span>{faq.question}</span>
                            <span className="shrink-0 text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">
                                +
                            </span>
                        </summary>
                        <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
                            {faq.answer}
                        </p>
                    </details>
                ))}
            </div>
        </ResponsiveDialog>
    );
}
