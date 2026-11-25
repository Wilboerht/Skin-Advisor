"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { SHEET_SIDE_RADIUS } from "./modal-styles";
import { useModalBackClose } from "@/hooks/use-modal-back-close";

function Sheet({
    open,
    onOpenChange,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
    useModalBackClose(Boolean(open), () => onOpenChange?.(false));
    return (
        <SheetPrimitive.Root
            open={open}
            onOpenChange={onOpenChange}
            {...props}
        />
    );
}

function SheetTrigger(
    props: React.ComponentProps<typeof SheetPrimitive.Trigger>,
) {
    return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
    return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal(
    props: React.ComponentProps<typeof SheetPrimitive.Portal>,
) {
    return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
    className,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
    return (
        <SheetPrimitive.Overlay
            data-slot="sheet-overlay"
            className={cn(
                "fixed inset-0 z-[var(--z-modal)] bg-brand-charcoal/25 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
                className,
            )}
            {...props}
        />
    );
}

const sideClasses = {
    right: "inset-y-0 right-0 h-full w-full max-w-md border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
    left: "inset-y-0 left-0 h-full w-full max-w-md border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
    top: "inset-x-0 top-0 h-auto max-h-[85dvh] w-full border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
    bottom: "inset-x-0 bottom-0 h-auto max-h-[85dvh] w-full border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
} as const;

function SheetContent({
    className,
    children,
    side = "right",
    showCloseButton = true,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
    side?: keyof typeof sideClasses;
    showCloseButton?: boolean;
}) {
    return (
        <SheetPortal>
            <SheetOverlay />
            <SheetPrimitive.Content
                data-slot="sheet-content"
                className={cn(
                    "fixed z-[var(--z-modal)] flex flex-col gap-0 bg-dialog text-dialog-foreground shadow-dialog outline-none",
                    "data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:duration-300",
                    sideClasses[side],
                    SHEET_SIDE_RADIUS[side],
                    className,
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <SheetPrimitive.Close asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="关闭"
                            className="absolute top-4 right-4"
                        >
                            <XIcon />
                        </Button>
                    </SheetPrimitive.Close>
                )}
            </SheetPrimitive.Content>
        </SheetPortal>
    );
}

function SheetHeader({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sheet-header"
            className={cn(
                "flex shrink-0 flex-col gap-1.5 border-b border-border/70 px-6 py-4 pr-14 text-left",
                className,
            )}
            {...props}
        />
    );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sheet-body"
            className={cn(
                "flex-1 overflow-y-auto overscroll-y-contain px-6 py-4",
                className,
            )}
            {...props}
        />
    );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sheet-footer"
            className={cn(
                "mt-auto flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 px-6 py-4 sm:flex-row sm:justify-end",
                className,
            )}
            {...props}
        />
    );
}

function SheetTitle({
    className,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
    return (
        <SheetPrimitive.Title
            data-slot="sheet-title"
            className={cn("text-lg leading-none font-semibold", className)}
            {...props}
        />
    );
}

function SheetDescription({
    className,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
    return (
        <SheetPrimitive.Description
            data-slot="sheet-description"
            className={cn("text-sm leading-relaxed text-muted-foreground", className)}
            {...props}
        />
    );
}

export {
    Sheet,
    SheetBody,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetOverlay,
    SheetPortal,
    SheetTitle,
    SheetTrigger,
};
