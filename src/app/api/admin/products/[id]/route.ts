
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth, requireRole, logAdminAction, getClientInfo } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

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
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-product-update-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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

        // Validate string fields
        if (updateData.name !== undefined && (typeof updateData.name !== "string" || updateData.name.length > 200)) {
            return NextResponse.json({ error: "Invalid name (max 200 chars)" }, { status: 400 });
        }
        if (updateData.category !== undefined && (typeof updateData.category !== "string" || updateData.category.length > 100)) {
            return NextResponse.json({ error: "Invalid category (max 100 chars)" }, { status: 400 });
        }
        if (updateData.image !== undefined && (typeof updateData.image !== "string" || updateData.image.length > 500)) {
            return NextResponse.json({ error: "Invalid image URL (max 500 chars)" }, { status: 400 });
        }
        if (updateData.description !== undefined && updateData.description !== null && (typeof updateData.description !== "string" || updateData.description.length > 5000)) {
            return NextResponse.json({ error: "Description too long (max 5000 chars)" }, { status: 400 });
        }
        if (updateData.price !== undefined && updateData.price !== null && (typeof updateData.price !== "string" || updateData.price.length > 50)) {
            return NextResponse.json({ error: "Invalid price (max 50 chars)" }, { status: 400 });
        }

        // Validate array fields
        if (updateData.images !== undefined && updateData.images !== null) {
            if (!Array.isArray(updateData.images) || updateData.images.length > 5) {
                return NextResponse.json({ error: "images must be an array with at most 5 items" }, { status: 400 });
            }
            if (!updateData.images.every((img: unknown) => typeof img === "string" && (img as string).length <= 500)) {
                return NextResponse.json({ error: "Each image must be a string URL (max 500 chars)" }, { status: 400 });
            }
        }

        // Validate boolean fields
        if (updateData.active !== undefined) {
            updateData.active = updateData.active === true;
        }
        if (updateData.featured !== undefined) {
            updateData.featured = updateData.featured === true;
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
    // Rate limit
    const ip = getClientIP(request);
    const limitResult = await rateLimit(`admin-product-delete-${ip}`, "default", { maxRequests: 30, windowMs: 60 * 1000 });
    if (!limitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const { id } = await params;
        const clientInfo = getClientInfo(request);

        await prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({ where: { id } });
            if (!product) {
                throw new Error("NOT_FOUND");
            }

            await tx.product.delete({ where: { id } });
            // Junction table records are automatically cleaned up via onDelete: Cascade

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
