"use client";

import { useEffect } from "react";
import { useUser } from "@/components/auth/UserProvider";

export default function LoginPage() {
    const { login } = useUser();

    useEffect(() => {
        // Trigger SSO login redirect. The central SSO login page handles
        // password, SMS code and registration flows.
        login();
    }, [login]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <p className="text-muted-foreground">正在跳转到 NIHPLOD 登录页…</p>
        </div>
    );
}
