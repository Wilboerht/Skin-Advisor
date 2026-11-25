import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    className?: string;
}

export function FormSection({
    title,
    description,
    children,
    className,
}: FormSectionProps) {
    return (
        <section
            className={cn(
                "rounded-2xl border border-border/80 bg-card p-4 sm:p-6",
                className,
            )}
        >
            {(title || description) && (
                <div className="mb-4 sm:mb-6">
                    {title && (
                        <h2 className="text-base font-medium text-foreground sm:text-lg">
                            {title}
                        </h2>
                    )}
                    {description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
            )}
            {children}
        </section>
    );
}
