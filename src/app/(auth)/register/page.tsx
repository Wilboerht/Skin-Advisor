"use client";

import { useEffect } from "react";
import { useUser } from "@/components/auth/UserProvider";

export default function RegisterPage() {
    const { register } = useUser();

    useEffect(() => {
        // Trigger SSO login redirect. Users can register on the central SSO page.
        register();
    }, [register]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <p className="text-muted-foreground">正在跳转到 NIHPLOD 注册页…</p>
        </div>
    );
}
