
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

        // Get old product for audit log
        const oldProduct = await prisma.product.findUnique({ where: { id } });

        const product = await prisma.product.update({
            where: { id },
            data: {
                name: body.name,
                nameEn: body.nameEn,
                category: body.category,
                image: body.image,
                price: body.price,
                description: body.description,
                keyIngredients: body.keyIngredients,
                suitableSkinTypes: body.suitableSkinTypes,
                benefits: body.benefits,
                sortOrder: body.sortOrder,
                active: body.active,
                stock: body.stock,
            }
        });

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: "update",
            resource: "Product",
            resourceId: id,
            details: {
                oldName: oldProduct?.name,
                newName: body.name,
                changes: Object.keys(body)
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
