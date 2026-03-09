import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        const officialResponse = await fetch(`${officialApiUrl}/api/auth/send-code`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
        });

        const responseData = await officialResponse.json();

        if (!officialResponse.ok || !responseData.success) {
            return NextResponse.json(
                { error: responseData.error?.message || "发送验证码失败" },
                { status: officialResponse.status || 400 }
            );
        }

        return NextResponse.json(responseData);

    } catch (e) {
        console.error("SendCode Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
