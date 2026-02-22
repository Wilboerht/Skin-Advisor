import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    // 从环境变量获取 AppID，这在微信后台的接口配置页有显示
    const appId = process.env.WECHAT_APP_ID;

    if (!appId) {
        return new NextResponse("WECHAT_APP_ID 不存在", { status: 500 });
    }

    // 构建我们需要微信跳回来的“回调地址”(Callback URL)
    // 如果你在生产环境，也就是你的 Vercel 域名加上回调路由
    // 注意，这里的域名必须在公众号后台的“网页授权域名”里配置过！
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://advisor.nihplod.cn";
    const redirectUri = encodeURIComponent(`${baseUrl}/api/wechat/callback`);

    // 微信 OAuth 2.0 授权机制：
    // 如果你只需要用户的 openID，也就是静默授权，scope 填 snsapi_base 即可（用户无感知）
    // 微信一旦验证 ok，会带着 code 自动 302 重定向到我们设定的 redirectUri
    const scope = "snsapi_base";

    // 用户授权后，附带在 redirectUri 上的状态参数。我们可以用它来标记是从哪里点进来的，或者直接就是防跨站标记。
    const state = "wechat_login";

    // 组装最终发给微信的认证网关 URL
    const wechatAuthUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;

    // 触发 302 临时重定向，让微信接管页面的跳跃
    return NextResponse.redirect(wechatAuthUrl);
}
