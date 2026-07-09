/**
 * 微信授权入口代理。
 *
 * 由于 __Host- Cookie 无法跨域，官网颁发的 wechat_oauth_nonce 必须写在官网域名下。
 * 因此子站不直接返回 authUrl，而是把用户浏览器 302 到官网 /api/auth/wechat 入口，
 * 让官网设置 nonce Cookie 后再跳转到微信授权页。
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

function getSafeRedirect(req: NextRequest, redirect: string | null): string {
    if (!redirect || redirect === "/") return "/";
    const origin = new URL(req.url).origin;
    if (redirect.startsWith("/") && !redirect.startsWith("//")) return redirect;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL;
    try {
        const redirectOrigin = new URL(redirect).origin;
        if (redirectOrigin === origin) return redirect;
        if (siteUrl && redirectOrigin === new URL(siteUrl).origin) return redirect;
    } catch {
        // invalid URL, fall through
    }
    return "/";
}

export async function GET(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`wechat-ip-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!ipLimit.success) {
            return NextResponse.json({ success: false, error: { message: "请求过于频繁，请稍后再试" } }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const redirect = getSafeRedirect(req, searchParams.get("redirect"));

        // 子站回调域名，告知官网授权完成后跳回子站
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL;
        if (!siteUrl) {
            return NextResponse.json({ success: false, error: { message: "未配置子站域名" } }, { status: 500 });
        }

        const callbackBase = siteUrl.replace(/\/$/, "");
        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        const officialUrl = new URL("/api/auth/wechat", officialApiUrl);
        officialUrl.searchParams.set("redirect", redirect);
        officialUrl.searchParams.set("callback", callbackBase);
        officialUrl.searchParams.set("mode", "redirect");

        return NextResponse.redirect(officialUrl.toString(), 302);
    } catch (e) {
        console.error("Wechat Login Proxy Error", e);
        return NextResponse.json({ success: false, error: { message: "应用系统异常，请稍后重试" } }, { status: 500 });
    }
}
