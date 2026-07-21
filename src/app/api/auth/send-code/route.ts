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
        const ip = getClientIP(req);
        // Shared rate limit key with forgot-password: 3 req/5min per IP
        const ipLimit = await rateLimit(`sms-send-ip-${ip}`, "login", { maxRequests: 3, windowMs: 5 * 60 * 1000 });
        if (!ipLimit.success) {
            return apiError(ErrorCode.RATE_LIMITED, "验证码发送过于频繁，请稍后再试", 429);
        }

        const body = await req.json();

        if (!body.phone || !PHONE_REGEX.test(body.phone)) {
            return apiError(ErrorCode.VALIDATION_ERROR, "请输入有效的手机号", 400);
        }

        const validTypes = ["register", "login", "reset"];
        if (!body.type || !validTypes.includes(body.type)) {
            return apiError(ErrorCode.VALIDATION_ERROR, "无效的验证码类型", 400);
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
            return apiError(ErrorCode.UPSTREAM_ERROR, "发送验证码失败：上游服务响应异常", 502);
        }

        const responseData = result.data;

        if (!result.ok || !responseData.success) {
            return NextResponse.json(
                { success: false, error: responseData.error || { code: ErrorCode.UPSTREAM_ERROR, message: "发送验证码失败" } },
                { status: result.status || 400 }
            );
        }

        return NextResponse.json(responseData);

    } catch (e) {
        logger.error("SendCode Proxy Error", e);
        return apiError(ErrorCode.INTERNAL_ERROR, "应用系统异常，请稍后重试", 500);
    }
}
