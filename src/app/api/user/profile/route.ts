import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

export async function PUT(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return apiError(ErrorCode.UNAUTHORIZED, "请先登录", 401);
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

        // 2. 同步更新到官网
        const officialBody: { nickname?: string; avatar?: string } = {};
        if (updateData.name) officialBody.nickname = updateData.name;
        if (updateData.avatarUrl) officialBody.avatar = updateData.avatarUrl;

        // 仅透传官网相关 Cookie（user_token, user_refresh_token），不发送子站本地 auth_token
        const cookieStore = await cookies();
        const officialCookieNames = ["__Host-user_token", "__Host-user_refresh_token", "user_token", "user_refresh_token"];
        const allCookies = cookieStore.getAll()
            .filter(c => officialCookieNames.includes(c.name))
            .map(c => `${c.name}=${c.value}`).join('; ');

        try {
            await callOfficialApi<OfficialApiResponse<{ user: unknown }>>({
                method: "PUT",
                path: "/api/user/profile",
                body: officialBody,
                cookies: allCookies,
                requireSignature: false,
                timeoutMs: 10000,
            });
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
        return apiError(ErrorCode.INTERNAL_ERROR, "更新失败", 500);
    }
}
