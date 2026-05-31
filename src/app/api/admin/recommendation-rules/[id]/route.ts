import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { z } from "zod";

const RuleUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    priority: z.number().int().optional(),
    conditions: z.object({
        skinType: z.array(z.string()).optional(),
        concern: z.array(z.string()).optional(),
    }).strict().optional(),
    message: z.string().max(2000).optional(),
    active: z.boolean().optional(),
    productIds: z.array(z.string()).optional(),
});

// PUT /api/admin/recommendation-rules/[id]
export const PUT = requireRole("super_admin", "admin")(async (req: NextRequest, { admin, params }) => {
    // Rate limit
    const ip = getClientIP(req);
    const limitResult = await rateLimit(`admin-rule-update-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const { id } = await params;
        const body = await req.json();
        const parsed = RuleUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { productIds, ...ruleData } = parsed.data;

        const oldRule = await prisma.recommendationRule.findUnique({
            where: { id },
            include: { products: { select: { productId: true } } }
        });
        if (!oldRule) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

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
        });

        const updated = await prisma.recommendationRule.findUnique({
            where: { id },
            include: { products: { select: { productId: true } } }
        });

        // Audit log
        const clientInfo = getClientInfo(req);
        await logAdminAction({
            adminId: admin.adminId,
            action: "update",
            resource: "RecommendationRule",
            resourceId: id,
            details: {
                name: updated?.name,
                oldProductCount: oldRule.products.length,
                newProductCount: productIds?.length ?? oldRule.products.length,
                changes: Object.keys(ruleData),
            },
            ...clientInfo,
        });

        return NextResponse.json({
            ...updated,
            productIds: updated?.products.map(p => p.productId) || []
        });
    } catch {
        return NextResponse.json(
            { error: "Failed to update rule" },
            { status: 500 }
        );
    }
});

// DELETE /api/admin/recommendation-rules/[id]
export const DELETE = requireRole("super_admin", "admin")(async (req: NextRequest, { admin, params }) => {
    // Rate limit
    const ip = getClientIP(req);
    const limitResult = await rateLimit(`admin-rule-delete-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const { id } = await params;

        const rule = await prisma.recommendationRule.findUnique({
            where: { id },
            select: { name: true }
        });
        if (!rule) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
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

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: "Failed to delete rule" },
            { status: 500 }
        );
    }
});
