"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";
import {
    useLegalDocModal,
    type LegalDoc,
} from "@/components/website/LegalDocModalContext";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

const SSO_BASE_URL = (
    process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn"
).replace(/\/+$/, "");

const DOC_META: Record<
    LegalDoc,
    { title: string; embedPath: string; pagePath: string }
> = {
    privacy: { title: "隐私政策", embedPath: "/privacy/embed", pagePath: "/privacy" },
    terms: { title: "服务条款", embedPath: "/terms/embed", pagePath: "/terms" },
};

/**
 * LegalDocModal — 隐私政策/服务条款阅读弹层
 * 统一 ResponsiveDialog + iframe 嵌入主站
 */
export function LegalDocModal() {
    const { doc, closeLegalDoc } = useLegalDocModal();
    const isOpen = doc !== null;

    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        setLoaded(false);
        setFailed(false);
    }, [doc, attempt]);

    useEffect(() => {
        if (!isOpen || loaded || failed) return;
        const timer = window.setTimeout(() => setFailed(true), 15000);
        return () => window.clearTimeout(timer);
    }, [isOpen, loaded, failed, attempt]);

    const meta = doc ? DOC_META[doc] : null;

    return (
        <ResponsiveDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) closeLegalDoc();
            }}
            title={meta?.title}
            size="4xl"
            bodyClassName="relative p-0 overflow-hidden"
            footer={
                meta ? (
                    <Link
                        href={`${SSO_BASE_URL}${meta.pagePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                        })}
                    >
                        在新窗口打开
                        <ExternalLink />
                    </Link>
                ) : null
            }
        >
            {meta && (
                <div className="relative h-[65dvh] min-h-80 bg-card">
                    {!loaded && !failed && (
                        <div
                            className="absolute inset-0 space-y-5 p-6 md:p-8"
                            aria-busy="true"
                            aria-label={`${meta.title}加载中`}
                        >
                            <Skeleton className="h-6 w-40" />
                            {[0, 1, 2, 3].map((index) => (
                                <div key={index} className="space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-11/12" />
                                </div>
                            ))}
                        </div>
                    )}

                    {failed ? (
                        <div
                            role="alert"
                            className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6"
                        >
                            <p className="text-center text-sm text-muted-foreground">
                                {meta.title}加载失败，请检查网络后重试
                            </p>
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setAttempt((value) => value + 1)
                                    }
                                >
                                    <RefreshCw />
                                    重试
                                </Button>
                                <Link
                                    href={`${SSO_BASE_URL}${meta.pagePath}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={buttonVariants({
                                        variant: "ghost",
                                        size: "sm",
                                    })}
                                >
                                    新窗口打开
                                    <ExternalLink />
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <iframe
                            key={`${doc}-${attempt}`}
                            src={`${SSO_BASE_URL}${meta.embedPath}`}
                            title={meta.title}
                            onLoad={() => setLoaded(true)}
                            sandbox="allow-scripts allow-same-origin"
                            className={`h-full w-full transition-opacity duration-300 ${
                                loaded ? "opacity-100" : "opacity-0"
                            }`}
                        />
                    )}
                </div>
            )}
        </ResponsiveDialog>
    );
}
