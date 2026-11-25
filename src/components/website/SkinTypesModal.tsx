"use client";

import { skinTypes, routeOrder, type SkinTypeData } from "@/lib/result-content";
import { SkinTypesClient } from "@/components/website/SkinTypesClient";
import { SkinTypesMobileList } from "@/components/website/SkinTypesMobileList";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";

interface SkinTypesModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** 分析等待期复用时置 true：隐藏测一测 / 开始测肤 CTA */
    hideTestCTA?: boolean;
}

const orderedTypes = routeOrder
    .map((route) => skinTypes.find((type) => type.route === route))
    .filter((type): type is SkinTypeData => Boolean(type));

/**
 * SkinTypesModal — 肌智派类型总览弹窗
 * 统一 ResponsiveDialog；内容由 SkinTypesClient / SkinTypesMobileList 提供
 */
export function SkinTypesModal({
    isOpen,
    onClose,
    hideTestCTA = false,
}: SkinTypesModalProps) {
    return (
        <ResponsiveDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="派系速览"
            description="肌因觉醒 智成一派"
            size="4xl"
            className="sm:max-w-[1100px]"
            footer={
                <p
                    suppressHydrationWarning
                    className="w-full text-center text-xs text-muted-foreground"
                >
                    &copy; {new Date().getFullYear()} NIHPLOD. All Rights
                    Reserved.
                </p>
            }
            footerClassName="justify-center"
        >
            <div className="md:hidden">
                <SkinTypesMobileList
                    types={orderedTypes}
                    hideTestCTA={hideTestCTA}
                />
            </div>
            <div className="hidden md:block">
                <SkinTypesClient
                    types={orderedTypes}
                    hideTestCTA={hideTestCTA}
                />
            </div>
        </ResponsiveDialog>
    );
}
