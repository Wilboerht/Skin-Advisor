import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { incrementTokenVersion, clearLocalSession } from "@/lib/auth";
import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { validatePasswordStrength } from "@/lib/password";
import { cookies } from "next/headers";

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

        // 与官网对齐的密码强度校验
        const passwordCheck = validatePasswordStrength(body.password);
        if (!passwordCheck.valid) {
            return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
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
            return NextResponse.json(
                { error: "重置失败：上游服务响应异常" },
                { status: 502 }
            );
        }

        const data = result.data;

        if (!result.ok || !data.success) {
            return NextResponse.json({ error: data.error?.message || "重置失败" }, { status: result.status || 400 });
        }

        // 密码重置后撤销该用户所有现有 JWT，强制重新登录
        const localUser = await prisma.user.findUnique({ where: { phoneNumber: body.phone }, select: { id: true } });
        if (localUser) {
            await incrementTokenVersion(localUser.id);
        }

        const response = NextResponse.json({ success: true, message: data.data?.message || "密码已重置" });

        // 清除本地 session 与官网 Cookie，确保重置后必须重新登录
        clearLocalSession(response);
        response.cookies.delete("__Host-user_token");
        response.cookies.delete("__Host-user_refresh_token");

        return response;

    } catch (error) {
        console.error("Reset Password Proxy Error", error);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
