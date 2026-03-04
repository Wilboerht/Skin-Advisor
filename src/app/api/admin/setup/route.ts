
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { PRODUCTS_CATALOG } from "@/config/products";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function GET() {
    try {
        // 1. Admin - Always ensure admin exists with admin123
        const hashedPassword = await bcrypt.hash("admin123", 12);
        await prisma.adminUser.upsert({
            where: { username: "admin" },
            update: { password: hashedPassword },
            create: {
                username: "admin",
                password: hashedPassword,
                name: "System Admin",
                role: "super_admin"
            }
        });
        const adminMsg = "Admin user ensured: admin / admin123";


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

        return NextResponse.json({
            success: true,
            messages: [adminMsg, productMsg]
        });

    } catch (error) {
        console.error("Setup failed:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
