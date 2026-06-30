import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth, requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { z } from "zod";

const RuleSchema = z.object({
    name: z.string().min(1).max(200),
    priority: z.number().int().default(0),
    conditions: z.object({
        skinType: z.array(z.string()).optional(),
        concern: z.array(z.string()).optional(),
        persona: z.array(z.string()).optional(),
    }).strict(),
    message: z.string().max(2000).optional(),
    active: z.boolean().default(true),
    productIds: z.array(z.string()).default([]),
});

// GET /api/admin/recommendation-rules
export const GET = withAdminAuth(async () => {
    const rules = await prisma.recommendationRule.findMany({
        orderBy: { priority: "desc" },
        include: {
            products: {
                select: { productId: true }
            }
        }
    });

    return NextResponse.json(rules.map(r => ({
        ...r,
        productIds: r.products.map(p => p.productId)
    })));
});

// POST /api/admin/recommendation-rules
export const POST = requireRole("super_admin", "admin")(async (req: NextRequest, { admin }) => {
    // Rate limit
    const ip = getClientIP(req);
    const limitResult = await rateLimit(`admin-rule-create-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const body = await req.json();
        const parsed = RuleSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { productIds, ...ruleData } = parsed.data;

        // Validate all productIds exist
        if (productIds.length > 0) {
            const existingProducts = await prisma.product.count({
                where: { id: { in: productIds } }
            });
            if (existingProducts !== productIds.length) {
                return NextResponse.json(
                    { error: "Some product IDs do not exist" },
                    { status: 400 }
                );
            }
        }

        const rule = await prisma.recommendationRule.create({
            data: {
                name: ruleData.name,
                priority: ruleData.priority,
                conditions: ruleData.conditions,
                message: ruleData.message,
                active: ruleData.active,
                products: {
                    create: productIds.map(pid => ({
                        productId: pid
                    }))
                }
            },
            include: {
                products: { select: { productId: true } }
            }
        });

        // Audit log
        const clientInfo = getClientInfo(req);
        await logAdminAction({
            adminId: admin.adminId,
            action: "create",
            resource: "RecommendationRule",
            resourceId: rule.id,
            details: { name: rule.name, productCount: productIds.length },
            ...clientInfo,
        });

        return NextResponse.json({ ...rule, productIds });
    } catch {
        return NextResponse.json(
            { error: "Failed to create rule" },
            { status: 500 }
        );
    }
});
