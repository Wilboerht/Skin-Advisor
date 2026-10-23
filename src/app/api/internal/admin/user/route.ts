import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardInternalUserRequest } from "@/lib/internal-guard";
import { updateAdminUser } from "@/lib/admin-user-update";
import { logger } from "@/lib/logger";

export const maxDuration = 15;

const patchSchema = z
    .object({
        dailyTestLimit: z.number().int().min(0).max(9999).optional(),
        role: z.enum(["user", "disabled"]).optional(),
    })
    .refine((data) => data.dailyTestLimit !== undefined || data.role !== undefined, {
        message: "patch 至少包含一个字段",
    });

const bodySchema = z.object({
    patch: patchSchema,
    operator: z.object({
        id: z.string().min(1).max(128),
        email: z.string().max(320).optional(),
        name: z.string().max(200).optional(),
    }),
    mainAuditId: z.string().max(64).optional(),
});

/**
 * 内部接口：管理端更新子站用户（供主站控制中台调用）
 *
 * PATCH /api/internal/admin/user?userId=
 * body: { patch: { dailyTestLimit?, role? }, operator: { id, email?, name? }, mainAuditId? }
 *
 * - userId 为主站 SSO sub，与子站 User.id 相同
 * - HMAC 签名绑定 query 与 body；写操作会落子站 AdminAuditLog
 * - 禁用/启用会递增 tokenVersion 并撤销本地 refresh token
 */
export async function PATCH(request: NextRequest) {
    const rawBody = await request.text();

    const guard = await guardInternalUserRequest(request, {
        scope: "admin-user-write",
        maxRequests: 30,
        rawBody,
    });
    if (guard.error) return guard.error;

    let parsedBody: unknown;
    try {
        parsedBody = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(parsedBody);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    try {
        const result = await updateAdminUser({
            userId: guard.userId,
            patch: parsed.data.patch,
            operator: parsed.data.operator,
            mainAuditId: parsed.data.mainAuditId,
            request,
        });

        if (!result.found) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: {
                changed: result.changed,
                previous: result.previous,
                current: result.current,
                revokedRefreshTokens: result.revokedRefreshTokens,
            },
        });
    } catch (error) {
        logger.error("[internal/admin/user] update failed", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
