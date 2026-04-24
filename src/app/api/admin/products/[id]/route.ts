
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const product = await prisma.product.findUnique({
            where: { id }
        });
        if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(product);
    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const clientInfo = getClientInfo(request);

        // Get old product for audit log and existence check
        const oldProduct = await prisma.product.findUnique({ where: { id } });
        if (!oldProduct) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        // Build update data — only include fields that are explicitly provided
        // This prevents accidentally nullifying fields when doing partial updates
        const allowedFields = [
            'name', 'nameEn', 'category', 'image', 'price', 'description',
            'keyIngredients', 'suitableSkinTypes', 'benefits', 'negativeFor', 'sortOrder',
            'active', 'stock', 'featured', 'step', 'howToUse',
            'affiliateLinks', 'ingredientDetails'
        ];

        const updateData: Record<string, any> = {};
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

        const product = await prisma.product.update({
            where: { id },
            data: updateData
        });

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: "update",
            resource: "Product",
            resourceId: id,
            details: {
                oldName: oldProduct.name,
                newName: updateData.name || oldProduct.name,
                changes: Object.keys(updateData)
            },
            ...clientInfo
        });

        return NextResponse.json(product);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const clientInfo = getClientInfo(request);

        // Get product name for audit log
        const product = await prisma.product.findUnique({ where: { id } });

        await prisma.product.delete({
            where: { id }
        });

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: "delete",
            resource: "Product",
            resourceId: id,
            details: { name: product?.name },
            ...clientInfo
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
