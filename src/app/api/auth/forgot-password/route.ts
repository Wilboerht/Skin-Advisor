import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
    try {
        const { phone } = await req.json();

        if (!phone) {
            return NextResponse.json({ error: "手机号不能为空" }, { status: 400 });
        }

        // 调用官网验证码发送接口（同注册/登录的验证码入口）
        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        const officialResponse = await fetch(`${officialApiUrl}/api/auth/send-code`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ phone })
        });

        const responseData = await officialResponse.json();

        if (!officialResponse.ok || !responseData.success) {
            return NextResponse.json(
                { error: responseData.error?.message || "发送验证码失败" },
                { status: officialResponse.status || 400 }
            );
        }

        return NextResponse.json({ success: true, message: "验证码已发送" });

    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
}
