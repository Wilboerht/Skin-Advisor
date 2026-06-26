import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export async function POST(req: NextRequest) {
    try {
        // 1. 速率限制
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`reset-password-ip-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!ipLimit.success) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
        }

        const body = await req.json();

        if (!body.phone || !PHONE_REGEX.test(body.phone)) {
            return NextResponse.json({ error: "请输入有效的手机号" }, { status: 400 });
        }
        if (!body.code || !body.password) {
            return NextResponse.json({ error: "缺少必填项" }, { status: 400 });
        }
        if (body.password.length < 8) {
            return NextResponse.json({ error: "密码长度至少为 8 位" }, { status: 400 });
        }
        if (!/[a-zA-Z]/.test(body.password) || !/[0-9]/.test(body.password)) {
            return NextResponse.json({ error: "密码需包含字母和数字" }, { status: 400 });
        }

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
                confirmPassword: body.password
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
