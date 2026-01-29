
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PRODUCTS_CATALOG } from "@/config/products";

export async function GET() {
    try {
        // 1. Check/Create Admin User
        const adminCount = await prisma.adminUser.count();
        let adminMsg = "Admin user already exists.";

        if (adminCount === 0) {
            await prisma.adminUser.create({
                data: {
                    username: "admin",
                    password: "admin123", // In a real app, hash this!
                    name: "System Admin",
                    role: "super_admin"
                }
            });
            adminMsg = "Created default admin (admin/admin123).";
        }


        // 2. Products - Manual entry only
        const productCount = await prisma.product.count();
        let productMsg = `Found ${productCount} existing products.`;

        if (productCount === 0) {
            console.log("Seeding products...");
            for (const p of PRODUCTS_CATALOG) {
                await prisma.product.create({
                    data: {
                        name: p.name,
                        nameEn: p.nameEn,
                        category: p.category,
                        image: p.image,
                        price: p.price,
                        description: p.description,
                        keyIngredients: p.keyIngredients,
                        suitableSkinTypes: p.suitableSkinTypes,
                        benefits: p.benefits,
                        active: true,
                        stock: 100,
                        featured: false
                    }
                });
            }
            productMsg = `Seeded ${PRODUCTS_CATALOG.length} products successfully.`;
        }

        // 3. Populate Questions (Optional - avoiding duplicates)
        // For now, we assume questions are still static config or we'll migrate them later if requested.
        // The user specifically asked to "make data alive", products are the most obvious target.

        return NextResponse.json({
            success: true,
            messages: [adminMsg, productMsg]
        });

    } catch (error) {
        console.error("Setup failed:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
