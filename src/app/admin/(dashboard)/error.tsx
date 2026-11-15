"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PanelCard } from "@/components/admin/PanelCard";

export default function AdminDashboardError({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    useEffect(() => {
        console.error("Admin dashboard page error:", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <PanelCard className="w-full max-w-md text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                    <AlertTriangle className="h-7 w-7" />
                </div>
                <h2 className="text-base font-medium text-brand-charcoal">
                    数据加载失败
                </h2>
                <p className="mt-1 text-sm text-brand-charcoal/65">
                    加载后台数据时出现异常，请稍后重试。
                </p>
                {error.digest && (
                    <p className="mt-3 font-mono text-xs text-brand-charcoal/55">
                        Error ID: {error.digest}
                    </p>
                )}
                <div className="mt-5 flex justify-center">
                    <Button
                        size="sm"
                        onClick={() => retry()}
                        leftIcon={<RefreshCcw className="h-4 w-4" />}
                    >
                        重试
                    </Button>
                </div>
            </PanelCard>
        </div>
    );
}
