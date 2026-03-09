import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
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
