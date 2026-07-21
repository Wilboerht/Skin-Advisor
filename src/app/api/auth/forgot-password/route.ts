import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export async function POST(req: NextRequest) {
    try {
        // Shares rate limit key with send-code to prevent bypass
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`sms-send-ip-${ip}`, "login", { maxRequests: 3, windowMs: 5 * 60 * 1000 });
        if (!ipLimit.success) {
            return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
        }

        const { phone } = await req.json();

        if (!phone || !PHONE_REGEX.test(phone)) {
            return apiError(ErrorCode.VALIDATION_ERROR, "请输入有效的手机号", 400);
        }

        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

        const result = await callOfficialApi<OfficialApiResponse<{ expiresIn: number }>>({
            method: "POST",
            path: "/api/auth/send-code",
            body: { phone, type: "reset" },
            cookies: allCookies,
            requireSignature: false,
            timeoutMs: 30000,
        });

        if (!result) {
            return apiError(ErrorCode.UPSTREAM_ERROR, "发送验证码失败：上游服务响应异常", 502);
        }

        const responseData = result.data;

        if (!result.ok || !responseData.success) {
            // 官网对未注册手机号返回 SMS_SENT_MASKED，转换为通用成功响应避免泄露号码是否注册
            if (responseData.error?.code === "SMS_SENT_MASKED") {
                return NextResponse.json({ success: true, data: { expiresIn: 300 } });
            }
            return NextResponse.json(
                { success: false, error: responseData.error || { code: ErrorCode.UPSTREAM_ERROR, message: "发送验证码失败" } },
                { status: result.status || 400 }
            );
        }

        return NextResponse.json({ success: true, data: { expiresIn: responseData.data?.expiresIn || 300 } });

    } catch (error) {
        logger.error("Forgot password error:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "服务器内部错误", 500);
    }
}
