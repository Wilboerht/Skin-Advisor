import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import prisma from "@/lib/prisma";
import { getSessionUser, getAccessToken, SSO_BASE_URL } from "@/lib/sso-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export async function PUT(req: NextRequest) {
    try {
        const ip = getClientIP(req);
        const limit = await rateLimit(`profile-put-ip-${ip}`, "default", { maxRequests: 10, windowMs: 60 * 1000 });
        if (!limit.success) {
            return apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
        }

        const session = await getSessionUser(req);
        if (!session) {
            return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);
        }

        const token = await getAccessToken(req);
        if (!token) {
            return apiError(ErrorCode.UNAUTHORIZED, "登录已过期，请重新登录", 401);
        }

        const body = await req.json();
        const { name, avatar } = body;

        const updateData: { name?: string; avatarUrl?: string } = {};
        if (typeof name === "string") {
            updateData.name = name.trim().slice(0, 50);
        }
        if (typeof avatar === "string") {
            const trimmed = avatar.trim();
            const MAX_URL_LENGTH = 2000;
            if (trimmed.length > MAX_URL_LENGTH) {
                return apiError(ErrorCode.VALIDATION_ERROR, "头像 URL 过长", 400);
            }
            if (trimmed.startsWith("data:")) {
                return apiError(ErrorCode.VALIDATION_ERROR, "头像不支持 data: URL，请使用图片上传", 400);
            }
            const allowedSchemes = ["http:", "https:"];
            const hasAllowedScheme = allowedSchemes.some((scheme) => trimmed.startsWith(scheme));
            if (trimmed && !hasAllowedScheme) {
                return apiError(ErrorCode.VALIDATION_ERROR, "头像 URL 协议不合法", 400);
            }
            updateData.avatarUrl = trimmed;
        }

        if (Object.keys(updateData).length === 0) {
            return apiError(ErrorCode.VALIDATION_ERROR, "没有要更新的内容", 400);
        }

        // 1. 更新本地 DB
        const updatedUser = await prisma.user.update({
            where: { id: session.id },
            data: updateData,
            select: {
                id: true,
                phoneNumber: true,
                name: true,
                avatarUrl: true,
                role: true,
            },
        });

        // 2. 同步更新到官网（Bearer token，不再依赖官网 session cookie）
        const officialBody: { nickname?: string; avatar?: string } = {};
        if (updateData.name) officialBody.nickname = updateData.name;
        if (updateData.avatarUrl) officialBody.avatar = updateData.avatarUrl;

        try {
            const res = await fetch(`${SSO_BASE_URL}/api/user/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify(officialBody),
            });
            if (!res.ok) {
                logger.warn(`[user/profile] Official site sync returned ${res.status}`);
            }
        } catch (err) {
            logger.warn("[user/profile] Failed to sync profile to official site:", err);
        }

        return NextResponse.json({
            user: {
                id: updatedUser.id,
                phone: updatedUser.phoneNumber,
                name: updatedUser.name,
                avatar: updatedUser.avatarUrl,
                role: updatedUser.role,
            },
        });
    } catch (error) {
        logger.error("[user/profile] Update failed:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "信息更新未成功", 500);
    }
}
