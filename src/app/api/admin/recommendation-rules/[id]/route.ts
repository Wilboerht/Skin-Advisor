import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { z } from "zod";

const RuleUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    priority: z.number().int().optional(),
    conditions: z.object({}).passthrough().optional(),
    message: z.string().optional(),
    active: z.boolean().optional(),
    productIds: z.array(z.string()).optional(),
});

// PUT /api/admin/recommendation-rules/[id]
export const PUT = requireRole("super_admin", "admin")(async (req: NextRequest, ctx: { admin: unknown; params?: Promise<{ id: string }> }) => {
    try {
        const { id } = await ctx.params!;
        const body = await req.json();
        const parsed = RuleUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid data", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { productIds, ...ruleData } = parsed.data;

        await prisma.$transaction(async (tx) => {
            await tx.recommendationRule.update({
                where: { id },
                data: {
                    ...(ruleData.name !== undefined && { name: ruleData.name }),
                    ...(ruleData.priority !== undefined && { priority: ruleData.priority }),
                    ...(ruleData.conditions !== undefined && { conditions: ruleData.conditions as any }),
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

        return NextResponse.json({
            ...updated,
            productIds: updated?.products.map(p => p.productId) || []
        });
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message || "Failed to update rule" },
            { status: 500 }
        );
    }
});

// DELETE /api/admin/recommendation-rules/[id]
export const DELETE = requireRole("super_admin", "admin")(async (_req: NextRequest, ctx: { admin: unknown; params?: Promise<{ id: string }> }) => {
    try {
        const { id } = await ctx.params!;
        await prisma.recommendationRule.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message || "Failed to delete rule" },
            { status: 500 }
        );
    }
});
