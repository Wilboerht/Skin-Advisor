/**
 * POST /api/oss/sign
 * 获取阿里云 OSS 直传签名（支持游客和登录用户）
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { generateUploadPolicy } from "@/lib/ali-oss";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { getSessionUser } from "@/lib/sso-auth";
import { hasConsent } from "@/lib/consent";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
    try {
        // 1. 简单的身份/频率检查（不再强制登录，face-scan 对游客开放）
        const ip = getClientIP(request);
        const limitParams = await rateLimit(ip + ":oss-sign", "oss-sign", { maxRequests: 20 });
        if (!limitParams.success) {
            return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });
        }

        const body = await request.json();
        const { filename, type, size, sessionId, guestId, cookieId, fingerprint, kind } = body;

        if (!filename || !type) {
            return NextResponse.json({ error: "Missing filename or type" }, { status: 400 });
        }
        if (!Number.isInteger(size) || size <= 0) {
            return NextResponse.json({ error: "Missing file size" }, { status: 400 });
        }

        const uploadKind: "face" | "avatar" = kind === "avatar" ? "avatar" : "face";
        const maxSize = uploadKind === "avatar" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
        if (size > maxSize) {
            return NextResponse.json({ error: "文件过大" }, { status: 413 });
        }

        const signedInUser = await getSessionUser(request);
        if (!signedInUser) {
            return NextResponse.json({ error: "请先登录后再上传图片" }, { status: 401 });
        }
        if (uploadKind === "face" && process.env.CONSENT_ENFORCEMENT_ENABLED !== "false" && !(await hasConsent(signedInUser.id))) {
            return NextResponse.json({ error: "请先完成隐私授权" }, { status: 403 });
        }
        const avatarUser = uploadKind === "avatar" ? signedInUser : null;

        // 2. 白名单校验：仅允许图片 MIME 与扩展名
        const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
        const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
        if (!ALLOWED_TYPES.includes(type) || !ALLOWED_EXTS.includes(ext)) {
            return NextResponse.json({ error: "仅支持 jpg/png/webp/gif 图片上传" }, { status: 400 });
        }

        // 3. 路径隔离：使用可溯源但不暴露原始标识的短哈希作为前缀。
        // 头像使用登录用户 id 作为稳定标识，便于按用户归集；面部照片按游客/会话标识。
        const rawId = uploadKind === "avatar"
            ? avatarUser?.id
            : (sessionId || guestId || cookieId
                || request.headers.get("x-guest-cookie-id")
                || fingerprint
                || request.headers.get("x-fingerprint")
                || crypto.randomUUID());
        const idHash = crypto.createHash("sha256").update(String(rawId)).digest("hex").slice(0, 16);
        const date = new Date().toISOString().split("T")[0];
        const randomId = crypto.randomUUID();
        const prefix = uploadKind === "avatar" ? "avatars" : "guest";
        const objectName = `${prefix}/${idHash}/${date}/${randomId}${ext}`;

        // 4. 生成 PostObject 策略（content-length-range 由 OSS 强制执行）
        const signature = await generateUploadPolicy(filename, type, objectName, maxSize);

        return NextResponse.json({
            success: true,
            data: signature
        });

    } catch (error) {
        logger.error("OSS Sign Error:", error);
        // 如果是配置错误，返回 500 但不暴露细节，前端会降级到 Base64
        return NextResponse.json(
            { error: "云存储服务暂时不可用" },
            { status: 500 }
        );
    }
}
