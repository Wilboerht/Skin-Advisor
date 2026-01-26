
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const products = await prisma.product.findMany({
            orderBy: { sortOrder: 'asc' }
        });
        return NextResponse.json(products);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const product = await prisma.product.create({
            data: {
                name: body.name,
                nameEn: body.nameEn,
                category: body.category,
                image: body.image,
                price: body.price,
                description: body.description,
                keyIngredients: body.keyIngredients || [],
                suitableSkinTypes: body.suitableSkinTypes || [],
                benefits: body.benefits || [],
                sortOrder: body.sortOrder || 0,
                active: body.active ?? true,
                stock: body.stock || 0,
            }
        });
        return NextResponse.json(product);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
    }
}
