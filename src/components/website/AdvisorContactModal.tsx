"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MessageCircleHeart, QrCode, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { Badge } from "@/components/ui/Badge";

interface AdvisorContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/** 银卡及以上可联系专属 AI 护肤顾问 */
export const ADVISOR_MEMBER_LEVELS = new Set([
    "SILVER",
    "GOLD",
    "DIAMOND",
    "ADVANCED",
]);

export const LEVEL_LABELS: Record<string, string> = {
    REGULAR: "普通会员",
    SILVER: "银卡会员",
    GOLD: "金卡会员",
    DIAMOND: "钻石会员",
    ADVANCED: "金卡会员",
};

export const ADVISOR_QR_SRC = "/images/advisor-qr.png";
export const ADVISOR_QR_DIAMOND_SRC = "/images/advisor-qr-diamond.jpg";

export function getAdvisorQrSrc(membershipLevel?: string): string {
    return membershipLevel === "DIAMOND"
        ? ADVISOR_QR_DIAMOND_SRC
        : ADVISOR_QR_SRC;
}

/**
 * AdvisorContactModal — 联系专属护肤顾问
 * 统一 ResponsiveDialog
 */
export function AdvisorContactModal({
    isOpen,
    onClose,
}: AdvisorContactModalProps) {
    const { user, isInitialized } = useAuth();
    const [qrFailed, setQrFailed] = useState(false);

    useEffect(() => {
        if (isOpen) setQrFailed(false);
    }, [isOpen]);

    // 未登录时入口层已改为打开「我的」账户弹层的登录拦截视图；
    // 这里只守住不渲染带「联系专属顾问」标题的空壳。
    const open = isOpen && isInitialized && !!user;
    const hasAccess =
        !!user && ADVISOR_MEMBER_LEVELS.has(user.membershipLevel ?? "");

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
            title="联系专属顾问"
            size="sm"
        >
            {!user ? null : hasAccess ? (
                <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
                        <MessageCircleHeart className="size-6 text-muted-foreground" />
                    </div>
                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                        微信扫码添加您的专属顾问
                        <br />
                        获取报告深度解读与一对一护理建议
                    </p>

                    <div className="w-full max-w-60 rounded-lg border bg-card p-3">
                        {qrFailed ? (
                            <div className="flex aspect-square w-full flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground">
                                <QrCode className="mb-2 size-10" />
                                <p className="text-xs">二维码占位</p>
                                <p className="mt-1 text-[10px]">
                                    public/images/advisor-qr.png
                                </p>
                            </div>
                        ) : (
                            <Image
                                src={getAdvisorQrSrc(user.membershipLevel ?? "")}
                                alt={
                                    user.membershipLevel === "DIAMOND"
                                        ? "专属人工顾问二维码"
                                        : "专属 AI 护肤顾问二维码"
                                }
                                width={240}
                                height={240}
                                unoptimized
                                className="h-auto w-full rounded-md"
                                onError={() => setQrFailed(true)}
                            />
                        )}
                        <p className="mt-3 text-center text-xs text-muted-foreground">
                            微信扫码添加
                        </p>
                    </div>

                    <p className="mt-5 text-xs text-muted-foreground">
                        专属于您的护肤管家，陪伴您的护肤旅程
                    </p>
                </div>
            ) : (
                <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
                        <Sparkles className="size-6 text-muted-foreground" />
                    </div>
                    <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                        银卡及以上会员可添加专属 AI 护肤顾问
                        <br />
                        获得报告解读、护理方案与产品搭配的一对一建议
                    </p>

                    <Badge variant="outline" className="mb-5">
                        当前等级 ·{" "}
                        {LEVEL_LABELS[user.membershipLevel ?? ""] || "普通会员"}
                    </Badge>

                    <div className="w-full rounded-lg border bg-muted/40 px-5 py-4">
                        <p className="text-sm leading-relaxed text-foreground">
                            升级银卡及以上会员即可解锁
                        </p>
                    </div>
                </div>
            )}
        </ResponsiveDialog>
    );
}
