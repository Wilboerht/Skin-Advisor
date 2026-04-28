import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

function generateState(): string {
    return crypto.randomBytes(16).toString("hex");
}

export async function GET(request: NextRequest) {
    // 从环境变量获取 AppID，这在微信后台的接口配置页有显示
    const appId = process.env.WECHAT_APP_ID;

    if (!appId) {
        return new NextResponse("WECHAT_APP_ID 不存在", { status: 500 });
    }

    // 构建我们需要微信跳回来的“回调地址”(Callback URL)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://advisor.nihplod.cn";
    const redirectUri = encodeURIComponent(`${baseUrl}/api/wechat/callback`);

    const scope = "snsapi_base";

    // Security: generate a random CSRF state token and store it in a short-lived cookie
    const state = generateState();
    const cookieStore = await cookies();
    cookieStore.set("wechat_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 5, // 5 minutes
        path: "/",
    });

    const wechatAuthUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;

    return NextResponse.redirect(wechatAuthUrl);
}
