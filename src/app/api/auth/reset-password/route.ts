import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { incrementTokenVersion, clearLocalSession } from "@/lib/auth";
import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { validatePasswordStrength } from "@/lib/password";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export async function POST(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        const ipLimit = await rateLimit(`reset-password-ip-${ip}`, "login", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!ipLimit.success) {
            return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
        }

        const body = await req.json();

        if (!body.phone || !PHONE_REGEX.test(body.phone)) {
            return apiError(ErrorCode.VALIDATION_ERROR, "请输入有效的手机号", 400);
        }
        if (!body.code || !body.password) {
            return apiError(ErrorCode.VALIDATION_ERROR, "缺少必填项", 400);
        }

        const passwordCheck = validatePasswordStrength(body.password);
        if (!passwordCheck.valid) {
            return apiError(ErrorCode.VALIDATION_ERROR, passwordCheck.message || "密码不符合要求", 400);
        }

        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

        const result = await callOfficialApi<OfficialApiResponse<{ message: string }>>({
            method: "POST",
            path: "/api/auth/reset-password",
            body: {
                phone: body.phone,
                code: body.code,
                password: body.password,
                confirmPassword: body.password
            },
            cookies: allCookies,
            requireSignature: false,
            timeoutMs: 30000,
        });

        if (!result) {
            return apiError(ErrorCode.UPSTREAM_ERROR, "重置失败：上游服务响应异常", 502);
        }

        const responseData = result.data;

        if (!result.ok || !responseData.success) {
            return NextResponse.json(
                { success: false, error: responseData.error || { code: ErrorCode.VALIDATION_ERROR, message: "重置失败" } },
                { status: result.status || 400 }
            );
        }

        const localUser = await prisma.user.findUnique({ where: { phoneNumber: body.phone }, select: { id: true } });
        if (localUser) {
            await incrementTokenVersion(localUser.id);
            await prisma.refreshToken.updateMany({
                where: { userId: localUser.id, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        }

        const response = NextResponse.json({ success: true, data: { message: responseData.data?.message || "密码已重置" } });

        clearLocalSession(response);
        response.cookies.delete("__Host-user_token");
        response.cookies.delete("__Host-user_refresh_token");

        return response;

    } catch (error) {
        logger.error("Reset Password Proxy Error", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "应用系统异常，请稍后重试", 500);
    }
}
