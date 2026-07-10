import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        // Stricter limit for SMS: 3 requests per 5 minutes per IP
        const ipLimit = await rateLimit(`sendcode-ip-${ip}`, "login", { maxRequests: 3, windowMs: 5 * 60 * 1000 });
        if (!ipLimit.success) {
            return NextResponse.json(
                { error: "验证码发送过于频繁，请稍后再试" },
                { status: 429 }
            );
        }

        const body = await req.json();

        if (!body.phone || !PHONE_REGEX.test(body.phone)) {
            return NextResponse.json({ error: "请输入有效的手机号" }, { status: 400 });
        }

        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

        const result = await callOfficialApi<OfficialApiResponse<{ expiresIn: number }>>({
            method: "POST",
            path: "/api/auth/send-code",
            body,
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

        return NextResponse.json(responseData);

    } catch (e) {
        logger.error("SendCode Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
