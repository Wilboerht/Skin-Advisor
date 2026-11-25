"use client";

import type { LegalDoc } from "@/lib/legal-content";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    doc: LegalDoc;
}

/**
 * LegalModal — 页脚「隐私政策 / 服务条款」简版法律文本
 * 统一使用 ResponsiveDialog（移动端底部 Sheet，桌面端 Dialog）
 */
export function LegalModal({ isOpen, onClose, doc }: LegalModalProps) {
    return (
        <ResponsiveDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={doc.title}
            size="lg"
        >
            <div className="space-y-6">
                {doc.sections.map((section) => (
                    <section key={section.heading}>
                        <h3 className="mb-2 text-sm font-medium text-foreground">
                            {section.heading}
                        </h3>
                        {section.paragraphs.map((paragraph, index) => (
                            <p
                                key={index}
                                className="mt-2 text-sm leading-relaxed text-muted-foreground first:mt-0"
                            >
                                {paragraph}
                            </p>
                        ))}
                    </section>
                ))}
            </div>

            <p className="mt-8 border-t pt-5 text-center text-xs leading-relaxed text-muted-foreground">
                本页为摘要，完整版本以 NIHPLOD 主站为准：
                <a
                    href={doc.fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                >
                    查看完整版
                </a>
                。
            </p>
        </ResponsiveDialog>
    );
}
