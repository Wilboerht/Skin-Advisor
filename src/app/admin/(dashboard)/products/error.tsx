"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PanelCard } from "@/components/admin/PanelCard";

export default function ProductsErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        console.error("Products page error:", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <PanelCard className="w-full max-w-md text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                    <AlertTriangle className="h-7 w-7" />
                </div>
                <h2 className="text-base font-medium text-brand-charcoal">
                    产品列表加载失败
                </h2>
                <p className="mt-1 text-sm text-brand-charcoal/65">
                    加载产品数据时出现异常，请重试或返回产品列表。
                </p>
                {error.digest && (
                    <p className="mt-3 font-mono text-xs text-brand-charcoal/55">
                        Error ID: {error.digest}
                    </p>
                )}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/admin/products")}
                        leftIcon={<ArrowLeft className="h-4 w-4" />}
                    >
                        返回列表
                    </Button>
                    <Button
                        size="sm"
                        onClick={reset}
                        leftIcon={<RefreshCcw className="h-4 w-4" />}
                    >
                        重试
                    </Button>
                </div>
            </PanelCard>
        </div>
    );
}
