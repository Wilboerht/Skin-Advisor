import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";

        // 我们代理到官网重置密码 API
        const officialResponse = await fetch(`${officialApiUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // The official site schema expects phone, code, password, confirmPassword
            body: JSON.stringify({
                phone: body.phone,
                code: body.code,
                password: body.password,
                confirmPassword: body.password // We can send identical passwords to bypass the schema
            })
        });

        const data = await officialResponse.json();

        if (!officialResponse.ok || !data.success) {
            return NextResponse.json({ error: data.error?.message || "重置失败" }, { status: officialResponse.status || 400 });
        }

        return NextResponse.json({ success: true, message: data.data?.message || "密码已重置" });

    } catch (error) {
        console.error("Reset Password Proxy Error", error);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
