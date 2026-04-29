/**
 * POST /api/oss/sign
 * 获取阿里云 OSS 直传签名
 */
import { NextRequest, NextResponse } from "next/server";
import { generateUploadSignature } from "@/lib/ali-oss";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { getSession } from "@/lib/auth";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
    try {
        // 0. 必须登录才能获取 OSS 签名（支持普通用户或管理员）
        const user = await getSession();
        const admin = !user ? await verifyAdminSession() : null;
        if (!user && !admin) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        // 1. 简单的身份/频率检查
        const ip = getClientIP(request);
        const limitParams = await rateLimit(ip + ":oss-sign", "oss-sign", { maxRequests: 5 });
        if (!limitParams.success) {
            return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
        }

        const { filename, type } = await request.json();

        if (!filename || !type) {
            return NextResponse.json({ error: "Missing filename or type" }, { status: 400 });
        }

        // 2. 生成签名
        const signature = await generateUploadSignature(filename, type);

        return NextResponse.json({
            success: true,
            data: signature
        });

    } catch (error) {
        console.error("OSS Sign Error:", error);
        // 如果是配置错误，返回 500 但不暴露细节，前端会降级到 Base64
        return NextResponse.json(
            { error: "云存储服务暂时不可用" },
            { status: 500 }
        );
    }
}
