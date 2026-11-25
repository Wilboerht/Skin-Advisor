"use client";

import {
    CalendarCheck,
    CircleUserRound,
    ScanFace,
    TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/**
 * 全站统一「未登录 → 登录引导」视图
 */
export function LoginGuide({
    onNavigateLogin,
    onLoginIntent,
}: {
    onNavigateLogin?: () => void;
    onLoginIntent?: () => void;
}) {
    const { login } = useAuth();
    const toast = useToast();

    const handleLogin = () => {
        toast.info("正在前往 NIHPLOD 账号中心…");
        onLoginIntent?.();
        onNavigateLogin?.();
        login();
    };

    const features = [
        { icon: ScanFace, label: "在线测肤" },
        { icon: TrendingUp, label: "个性化护肤档案" },
        { icon: CalendarCheck, label: "专属顾问" },
    ];

    return (
        <div className="flex flex-col items-center py-4 text-center">
            <CircleUserRound
                className="mb-5 size-16 text-muted-foreground"
                strokeWidth={1}
            />
            <h3 className="mb-2.5 text-2xl font-semibold tracking-tight">
                登录肌智派
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">
                肌肤的现在和未来，我们与您同在
            </p>
            <div className="mb-7 flex flex-wrap items-center justify-center gap-2">
                {features.map((feature) => {
                    const Icon = feature.icon;
                    return (
                        <Badge
                            key={feature.label}
                            variant="outline"
                            className="h-6 gap-1.5 px-2.5 text-[11px] font-normal"
                        >
                            <Icon />
                            {feature.label}
                        </Badge>
                    );
                })}
            </div>
            <Button
                size="lg"
                onClick={handleLogin}
                className="min-w-[200px]"
            >
                登录 / 注册
            </Button>
        </div>
    );
}
