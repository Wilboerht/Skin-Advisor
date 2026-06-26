import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`wechat-ip-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!ipLimit.success) {
            return NextResponse.json({ success: false, error: { message: "请求过于频繁，请稍后再试" } }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const redirect = searchParams.get("redirect") || "/";

        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";

        // When initiating from subsite, we want the callback to return to the subsite.
        // The main site's /api/auth/wechat expects a redirect param.
        const res = await fetch(`${officialApiUrl}/api/auth/wechat?redirect=${encodeURIComponent(redirect)}`);
        const data = await res.json();

        return NextResponse.json(data);
    } catch (e) {
        console.error("Wechat Login Proxy Error", e);
        return NextResponse.json({ success: false, error: { message: "应用系统异常，请稍后重试" } }, { status: 500 });
    }
}
