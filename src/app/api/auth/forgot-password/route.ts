import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export async function POST(req: NextRequest) {
    try {
        // 1. 速率限制
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`forgot-password-ip-${ip}`, "login", { maxRequests: 3, windowMs: 5 * 60 * 1000 });
        if (!ipLimit.success) {
            return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
        }

        const { phone } = await req.json();

        if (!phone || !PHONE_REGEX.test(phone)) {
            return NextResponse.json({ error: "请输入有效的手机号" }, { status: 400 });
        }

        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

        // 调用官网验证码发送接口（同注册/登录的验证码入口）
        const result = await callOfficialApi<OfficialApiResponse<{ expiresIn: number }>>({
            method: "POST",
            path: "/api/auth/send-code",
            body: { phone, type: "reset" },
            cookies: allCookies,
            requireSignature: false,
            timeoutMs: 30000,
        });

        if (!result) {
            return NextResponse.json(
                { error: "发送验证码失败：上游服务响应异常" },
                { status: 502 }
            );
        }

        const responseData = result.data;

        if (!result.ok || !responseData.success) {
            return NextResponse.json(
                { error: responseData.error?.message || "发送验证码失败" },
                { status: result.status || 400 }
            );
        }

        return NextResponse.json({ success: true, message: "验证码已发送" });

    } catch (error) {
        logger.error("Forgot password error:", error);
        return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
}
