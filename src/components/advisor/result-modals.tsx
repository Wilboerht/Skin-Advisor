"use client";

import Image from "next/image";
import { AlertTriangle, Lightbulb, RotateCcw } from "lucide-react";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/* ------------------------- 性别不一致提示弹窗 ------------------------- */

interface GenderMismatchModalProps {
    faceAnalysis: FaceAnalysisResult | null;
    socialGender: string;
    hasUsedFreeRetry: boolean;
    onRetry: () => void;
    onContinue: () => void;
}

export function GenderMismatchModal({
    faceAnalysis,
    socialGender,
    hasUsedFreeRetry,
    onRetry,
    onContinue,
}: GenderMismatchModalProps) {
    return (
        <ResponsiveDialog
            open
            onOpenChange={(open) => {
                if (!open) onContinue();
            }}
            title="测前信息准确性提示"
            size="md"
            footer={
                <>
                    <Button
                        type="button"
                        onClick={onContinue}
                        variant="outline"
                    >
                        信息无误，继续查看
                    </Button>
                    <Button
                        type="button"
                        onClick={hasUsedFreeRetry ? onContinue : onRetry}
                        autoFocus
                    >
                        {hasUsedFreeRetry ? "我已了解" : "重新填写问卷"}
                        {!hasUsedFreeRetry && <RotateCcw />}
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <AlertTriangle className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        AI 面部识别结果显示您的面部特征更接近
                        <Badge variant="secondary" className="mx-1">
                            {faceAnalysis?.gender?.value === "male"
                                ? "男性"
                                : "女性"}
                        </Badge>
                        ，但您在问卷中选择的是
                        <Badge variant="secondary" className="mx-1">
                            {socialGender === "male" ? "男性" : "女性"}
                        </Badge>
                        ，二者不一致。
                    </p>
                </div>

                <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                        <p>
                            这可能会影响为您匹配“针对性护肤方案”的精准度，导致分析结论与您的实际肤感产生偏差。
                        </p>
                        {hasUsedFreeRetry ? (
                            <p>
                                该会话已使用过免费重试，重新填写将正常消耗测试次数。
                            </p>
                        ) : (
                            <p>
                                建议核实信息以获得更准确的建议。若是填写有误？
                                <span className="font-medium text-foreground">
                                    本次重新填写不消耗测试次数
                                </span>
                                。
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </ResponsiveDialog>
    );
}

/* ------------------------- 重新测试确认弹窗 ------------------------- */

interface ReTestConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function ReTestConfirmModal({
    isOpen,
    onClose,
    onConfirm,
}: ReTestConfirmModalProps) {
    return (
        <ResponsiveDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="重新测试？"
            description="重新测试将清空当前测肤记录，并消耗 1 次测试额度。确认开始吗？"
            size="md"
            footer={
                <>
                    <Button type="button" variant="outline" onClick={onClose}>
                        取消
                    </Button>
                    <Button type="button" onClick={onConfirm}>
                        重新测试
                    </Button>
                </>
            }
        >
            <p className="text-sm text-muted-foreground">
                建议先确认当前记录已保存或截图，再开始新的测试。
            </p>
        </ResponsiveDialog>
    );
}

/* ------------------------- 微信内嵌浏览器海报保存弹窗 ------------------------- */

interface PosterSaveModalProps {
    imageUrl: string | null;
    variant?: "mobile" | "desktop";
    onClose: () => void;
    onSaved?: () => void;
}

export function PosterSaveModal({
    imageUrl,
    variant = "mobile",
    onClose,
    onSaved,
}: PosterSaveModalProps) {
    const isDesktop = variant === "desktop";

    return (
        <ResponsiveDialog
            open={Boolean(imageUrl)}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={isDesktop ? "右键保存测肤证书" : "长按图片保存证书"}
            description={
                isDesktop
                    ? "微信内右键点击下方图片，选择「图片另存为」即可保存到电脑"
                    : "微信内长按下方图片，选择「保存图片」即可存入相册"
            }
            size="md"
            footer={
                <Button
                    type="button"
                    onClick={() => {
                        onSaved?.();
                        onClose();
                    }}
                >
                    已保存，关闭
                </Button>
            }
        >
            {imageUrl && (
                <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-lg border bg-muted">
                    <Image
                        src={imageUrl}
                        alt="肌智派证书海报"
                        width={480}
                        height={640}
                        unoptimized
                        className="h-auto w-full"
                    />
                </div>
            )}
        </ResponsiveDialog>
    );
}
