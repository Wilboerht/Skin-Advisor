import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import prisma from "@/lib/prisma";
import { requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { AdminRole } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { z } from "zod";

const RuleUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    priority: z.number().int().optional(),
    conditions: z.object({
        skinType: z.array(z.string()).optional(),
        concern: z.array(z.string()).optional(),
        persona: z.array(z.string()).optional(),
    }).strict().optional(),
    message: z.string().max(2000).optional(),
    active: z.boolean().optional(),
    productIds: z.array(z.string()).optional(),
});

// PUT /api/admin/recommendation-rules/[id]
export const PUT = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (req: NextRequest, { admin, params }) => {
    // Rate limit
    const ip = getClientIP(req);
    const limitResult = await rateLimit(`admin-rule-update-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return apiError(ErrorCode.RATE_LIMITED, "Too many requests", 429);
    }

    try {
        const { id } = await params;
        const body = await req.json();
        const parsed = RuleUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return apiError(ErrorCode.VALIDATION_ERROR, "Invalid data", 400, parsed.error.flatten());
        }

        const { productIds, ...ruleData } = parsed.data;

        const oldRule = await prisma.recommendationRule.findUnique({
            where: { id },
            include: { products: { select: { productId: true } } }
        });
        if (!oldRule) {
            return apiError(ErrorCode.NOT_FOUND, "Rule not found", 404);
        }

        // Validate all productIds exist before transaction
        if (productIds !== undefined && productIds.length > 0) {
            const existingProducts = await prisma.product.count({
                where: { id: { in: productIds } }
            });
            if (existingProducts !== productIds.length) {
                return apiError(ErrorCode.VALIDATION_ERROR, "Some product IDs do not exist", 400);
            }
        }

        const clientInfo = getClientInfo(req);

        await prisma.$transaction(async (tx) => {
            await tx.recommendationRule.update({
                where: { id },
                data: {
                    ...(ruleData.name !== undefined && { name: ruleData.name }),
                    ...(ruleData.priority !== undefined && { priority: ruleData.priority }),
                    ...(ruleData.conditions !== undefined && { conditions: ruleData.conditions }),
                    ...(ruleData.message !== undefined && { message: ruleData.message }),
                    ...(ruleData.active !== undefined && { active: ruleData.active }),
                }
            });

            if (productIds !== undefined) {
                await tx.recommendationRuleProduct.deleteMany({
                    where: { ruleId: id }
                });
                if (productIds.length > 0) {
                    await tx.recommendationRuleProduct.createMany({
                        data: productIds.map(pid => ({
                            ruleId: id,
                            productId: pid
                        }))
                    });
                }
            }

            // Audit log inside transaction
            await tx.adminAuditLog.create({
                data: {
                    adminId: admin.adminId,
                    action: "update",
                    resource: "RecommendationRule",
                    resourceId: id,
                    details: {
                        name: oldRule.name,
                        oldProductCount: oldRule.products.length,
                        newProductCount: productIds?.length ?? oldRule.products.length,
                        changes: Object.keys(ruleData),
                    },
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                }
            });
        });

        const updated = await prisma.recommendationRule.findUnique({
            where: { id },
            include: { products: { select: { productId: true } } }
        });

        return NextResponse.json({
            ...updated,
            productIds: updated?.products.map(p => p.productId) || []
        });
    } catch {
        return apiError(ErrorCode.INTERNAL_ERROR, "Failed to update rule", 500);
    }
});

// DELETE /api/admin/recommendation-rules/[id]
export const DELETE = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (req: NextRequest, { admin, params }) => {
    // Rate limit
    const ip = getClientIP(req);
    const limitResult = await rateLimit(`admin-rule-delete-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return apiError(ErrorCode.RATE_LIMITED, "Too many requests", 429);
    }

    try {
        const { id } = await params;

        const rule = await prisma.recommendationRule.findUnique({
            where: { id },
            select: { name: true }
        });
        if (!rule) {
            return apiError(ErrorCode.NOT_FOUND, "Rule not found", 404);
        }

        await prisma.recommendationRule.delete({ where: { id } });

        // Audit log
        const clientInfo = getClientInfo(req);
        await logAdminAction({
            adminId: admin.adminId,
            action: "delete",
            resource: "RecommendationRule",
            resourceId: id,
            details: { name: rule.name },
            ...clientInfo,
        });

        return apiSuccess();
    } catch {
        return apiError(ErrorCode.INTERNAL_ERROR, "Failed to delete rule", 500);
    }
});
