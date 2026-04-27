
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const products = await prisma.product.findMany({
            orderBy: { sortOrder: 'asc' }
        });
        return NextResponse.json(products);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const clientInfo = getClientInfo(request);

        const product = await prisma.product.create({
            data: {
                name: body.name,
                category: body.category,
                image: body.image,
                images: body.images || null,
                price: body.price,
                description: body.description,
                keyIngredients: body.keyIngredients || [],
                suitableSkinTypes: body.suitableSkinTypes || [],
                benefits: body.benefits || [],
                negativeFor: body.negativeFor || [],
                sortOrder: body.sortOrder || 0,
                active: body.active ?? true,
                stock: 999,
                step: body.step || null,
                howToUse: body.howToUse || null,
                affiliateLinks: body.affiliateLinks || null,
                featured: body.featured ?? false,
            }
        });

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: "create",
            resource: "Product",
            resourceId: product.id,
            details: { name: product.name, category: product.category },
            ...clientInfo
        });

        return NextResponse.json(product);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
    }
}
