"use client";

import { useEffect } from "react";
import { useUser } from "@/components/auth/UserProvider";
import { SsoRedirectScreen } from "@/components/auth/SsoRedirectScreen";

export default function RegisterPage() {
    const { register } = useUser();

    useEffect(() => {
        // Trigger SSO login redirect. Users can register on the central SSO page.
        register();
    }, [register]);

    return <SsoRedirectScreen message="正在跳转到 NIHPLOD 注册页…" />;
}
