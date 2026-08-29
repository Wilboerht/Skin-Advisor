"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * 微信授权回调 fallback 页面。
 *
 * 正常流程下，官网会直接 302 到 /api/auth/wechat/callback（API Route），
 * 不会进入此页面。保留该页面作为用户手动访问 /auth/wechat/callback 时的
 * 兼容入口，它会将参数原样转发到 API Route 完成登录/绑定。
 */
export default function WechatCallbackPage() {
    const searchParams = useSearchParams();
    const [message, setMessage] = useState("正在处理微信授权…");

    useEffect(() => {
        const exchangeToken = searchParams.get("wechat_exchange_token");
        const redirect = searchParams.get("redirect") || "/";
        const wechatAuth = searchParams.get("wechat_auth");

        if (!exchangeToken && wechatAuth !== "error") {
            setMessage("缺少微信授权凭证，请返回重试");
            return;
        }

        // 构造子站服务端回调 URL，让浏览器直接跳转，以便设置 Cookie 并跟随 302
        const callbackUrl = new URL("/api/auth/wechat/callback", window.location.origin);
        searchParams.forEach((value, key) => {
            callbackUrl.searchParams.set(key, value);
        });
        callbackUrl.searchParams.set("redirect", redirect);

        window.location.href = callbackUrl.toString();
    }, [searchParams]);

    return (
        // layout 已提供唯一 <main> 地标，这里用 div 避免嵌套
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] px-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-charcoal/20 border-t-brand-charcoal" />
            <p className="mt-6 text-sm tracking-wide text-brand-charcoal/70">{message}</p>
        </div>
    );
}
