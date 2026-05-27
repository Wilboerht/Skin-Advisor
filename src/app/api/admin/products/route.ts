
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth, logAdminAction, getClientInfo } from "@/lib/admin-auth";

// GET /api/admin/products - List products with pagination
// Available to all authenticated admin roles (including editor)
export const GET = withAdminAuth(async (request) => {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                orderBy: { sortOrder: 'asc' },
                skip,
                take: limit,
            }),
            prisma.product.count(),
        ]);

        return NextResponse.json({
            products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
});

// POST /api/admin/products - Create a new product
// Available to all authenticated admin roles (including editor)
export const POST = withAdminAuth(async (request, { admin }) => {
    try {
        const body = await request.json();
        const clientInfo = getClientInfo(request);

        // Basic input validation
        if (!body.name || typeof body.name !== "string" || body.name.length > 200) {
            return NextResponse.json({ error: "Invalid name (required, max 200 chars)" }, { status: 400 });
        }
        if (!body.category || typeof body.category !== "string" || body.category.length > 100) {
            return NextResponse.json({ error: "Invalid category (required, max 100 chars)" }, { status: 400 });
        }
        if (!body.image || typeof body.image !== "string" || body.image.length > 500) {
            return NextResponse.json({ error: "Invalid image URL (required, max 500 chars)" }, { status: 400 });
        }
        if (body.description && typeof body.description === "string" && body.description.length > 5000) {
            return NextResponse.json({ error: "Description too long (max 5000 chars)" }, { status: 400 });
        }
        if (body.price && (typeof body.price !== "string" || body.price.length > 50)) {
            return NextResponse.json({ error: "Invalid price (max 50 chars)" }, { status: 400 });
        }

        // Enhanced input validation
        if (body.images !== undefined && body.images !== null) {
            if (!Array.isArray(body.images) || body.images.length > 5) {
                return NextResponse.json({ error: "images must be an array with at most 5 items" }, { status: 400 });
            }
            if (!body.images.every((img: unknown) => typeof img === "string")) {
                return NextResponse.json({ error: "Each image must be a string" }, { status: 400 });
            }
        }
        if (body.sortOrder !== undefined) {
            if (!Number.isFinite(Number(body.sortOrder))) {
                return NextResponse.json({ error: "Invalid sortOrder (must be a finite number)" }, { status: 400 });
            }
        }
        if (body.keyIngredients !== undefined && !Array.isArray(body.keyIngredients)) {
            return NextResponse.json({ error: "keyIngredients must be an array" }, { status: 400 });
        }
        if (body.suitableSkinTypes !== undefined && !Array.isArray(body.suitableSkinTypes)) {
            return NextResponse.json({ error: "suitableSkinTypes must be an array" }, { status: 400 });
        }
        if (body.benefits !== undefined && !Array.isArray(body.benefits)) {
            return NextResponse.json({ error: "benefits must be an array" }, { status: 400 });
        }
        if (body.negativeFor !== undefined && !Array.isArray(body.negativeFor)) {
            return NextResponse.json({ error: "negativeFor must be an array" }, { status: 400 });
        }

        const [product] = await prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
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
                    howToUse: body.howToUse || null,
                    affiliateLinks: body.affiliateLinks || null,
                    featured: body.featured ?? false,
                }
            });

            await tx.adminAuditLog.create({
                data: {
                    adminId: admin.adminId,
                    action: "create",
                    resource: "Product",
                    resourceId: product.id,
                    details: { name: product.name, category: product.category },
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent,
                }
            });

            return [product];
        });

        return NextResponse.json(product);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
    }
});
