import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth, requireRole } from "@/lib/admin-auth";
import { z } from "zod";

const RuleSchema = z.object({
    name: z.string().min(1),
    priority: z.number().int().default(0),
    conditions: z.object({
        skinType: z.array(z.string()).optional(),
        concern: z.array(z.string()).optional(),
    }).passthrough(),
    message: z.string().optional(),
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
export const POST = requireRole("super_admin", "admin")(async (req: NextRequest) => {
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

        const rule = await prisma.recommendationRule.create({
            data: {
                name: ruleData.name,
                priority: ruleData.priority,
                conditions: ruleData.conditions as any,
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

        return NextResponse.json({ ...rule, productIds });
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message || "Failed to create rule" },
            { status: 500 }
        );
    }
});
