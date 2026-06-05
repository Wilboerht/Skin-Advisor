import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
        return new NextResponse("授权失败，未获取到微信返回的 Code", { status: 400 });
    }

    // Security: validate CSRF state parameter
    const cookieStore = await cookies();
    const expectedState = cookieStore.get("wechat_oauth_state")?.value;
    if (!expectedState || expectedState !== state) {
        console.error("[Security] WeChat OAuth state mismatch. Possible CSRF attack.", { expectedState, receivedState: state });
        return new NextResponse("授权验证失败，请重新尝试", { status: 403 });
    }
    // Clear the state cookie immediately after validation
    cookieStore.set("wechat_oauth_state", "", { maxAge: 0, path: "/" });

    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!appId || !appSecret) {
        return new NextResponse("服务器环境缺失微信配置参数", { status: 500 });
    }

    try {
        // 拿着刚刚拿到的 code 和咱们的密码(AppSecret)，向微信服务器请求令牌(access_token)
        // 对于 snsapi_base 授权来说，最重要的一点：这一步的返回值里就包含用户的 openid 了！
        const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

        // 我们在这里使用原生的 fetch。
        const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
        const tokenData = await tokenResponse.json();

        // 如果微信返回的带有一个 errcode，说明 code 失效或配置参数错误等
        if (tokenData.errcode) {
            console.error("通过 code 换取微信 openid 出错：", tokenData);
            return new NextResponse(`微信鉴权失败: ${tokenData.errmsg}`, { status: 400 });
        }

        // 核心信息来了！拿到 openid
        const openid = tokenData.openid;
        const unionid = tokenData.unionid; // 只有当你公众号绑定了微信开放平台才会返回，多终端联合唯一主键

        // ====== 开始系统内的业务逻辑（静默注册或登录） =========

        // 1. 去咱们自己用 Prisma 维护的 User 表里查，有没有存在这个威信用户
        let dbUser = await prisma.user.findFirst({
            where: { wechatOpenId: openid },
        });

        // 2. 如果没查到，证明是完全新来的用户，我们给他一键走个注册逻辑（静默注册）
        if (!dbUser) {
            dbUser = await prisma.user.create({
                data: {
                    wechatOpenId: openid,
                    ...(unionid && { wechatUnionId: unionid }),
                    // 静默注册：微信用户无需密码
                    name: "微信用户_" + Math.random().toString(36).substring(7),
                    role: "user",
                },
            });
        } else {
            // 如果用户以前存在，但是开放平台刚打通了 UnionID，可以在这顺手给他绑上
            if (unionid && !dbUser.wechatUnionId) {
                dbUser = await prisma.user.update({
                    where: { id: dbUser.id },
                    data: { wechatUnionId: unionid }
                });
            }
        }

        // 3. 用户鉴别完毕（无论是老用户还是刚创建好的新用户），我们给他发一张项目的 JWT 门票让他顺畅浏览网页！
        // 使用统一的 signToken 确保 secret 和 payload 格式一致
        const token = await signToken({
            sub: dbUser.id,
            role: dbUser.role,
            dailyTestLimit: dbUser.dailyTestLimit
        }, "30d");

        // 4. 重定向去前端界面，而且带上包含凭证的 HttpOnly Cookie！
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://advisor.nihplod.cn";
        // 如果想要导向你的测肤起始页面或者是首页，就改这里
        const finalDestinationUrl = `${baseUrl}/?tab=advisor`;

        const response = NextResponse.redirect(finalDestinationUrl);

        // 把签好的 JWT 塞在叫 "auth_token" 的 Cookie 里，这就是 Web 系统接管后续鉴权的关键
        response.cookies.set("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60, // 30天
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("微信全链登录异常:", error);
        return new NextResponse("服务器内部错误", { status: 500 });
    }
}
