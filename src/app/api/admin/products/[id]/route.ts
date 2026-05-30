
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth, requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";

// GET /api/admin/products/[id] - Get product details
// Available to all authenticated admin roles (including editor)
export const GET = withAdminAuth(async (
    request: NextRequest,
    { params }
) => {
    try {
        const { id } = await params;
        const product = await prisma.product.findUnique({
            where: { id }
        });
        if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(product);
    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
});

// PUT /api/admin/products/[id] - Update product
// Available to all authenticated admin roles (including editor)
export const PUT = withAdminAuth(async (
    request: NextRequest,
    { admin, params }
) => {
    try {
        const { id } = await params;
        const body = await request.json();
        const clientInfo = getClientInfo(request);

        // Build update data — only include fields that are explicitly provided
        const allowedFields = [
            'name', 'category', 'image', 'images', 'price', 'description',
            'keyIngredients', 'suitableSkinTypes', 'benefits', 'negativeFor', 'sortOrder',
            'active', 'featured', 'howToUse',
            'affiliateLinks'
        ];

        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        const txResult = await prisma.$transaction(async (tx) => {
            const oldProduct = await tx.product.findUnique({ where: { id } });
            if (!oldProduct) {
                return { type: "not_found" as const };
            }

            const product = await tx.product.update({
                where: { id },
                data: updateData
            });

            await tx.adminAuditLog.create({
                data: {
                    adminId: admin.adminId,
                    action: "update",
                    resource: "Product",
                    resourceId: id,
                    details: {
                        oldName: oldProduct.name,
                        newName: updateData.name || oldProduct.name,
                        changes: Object.keys(updateData)
                    },
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                }
            });

            return { type: "success" as const, product };
        });

        if (txResult.type === "not_found") {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        return NextResponse.json(txResult.product);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
});

// DELETE /api/admin/products/[id] - Delete product
// Restricted to super_admin and admin (editor cannot delete products)
export const DELETE = requireRole("super_admin", "admin")(async (
    request: NextRequest,
    { admin, params }
) => {
    try {
        const { id } = await params;
        const clientInfo = getClientInfo(request);

        await prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({ where: { id } });
            if (!product) {
                throw new Error("NOT_FOUND");
            }

            await tx.product.delete({ where: { id } });

            // Clean up RecommendationRule references via junction table
            await tx.recommendationRuleProduct.deleteMany({
                where: { productId: id }
            });

            await tx.adminAuditLog.create({
                data: {
                    adminId: admin.adminId,
                    action: "delete",
                    resource: "Product",
                    resourceId: id,
                    details: { name: product.name },
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "NOT_FOUND") {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
});
