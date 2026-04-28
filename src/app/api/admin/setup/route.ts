
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { PRODUCTS_CATALOG } from "@/config/products";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function GET() {
    try {
        // 1. Security: verify admin session first
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2. Admin - Only create if not exists, NEVER reset existing password
        const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
        let adminMsg: string;
        const existingAdmin = await prisma.adminUser.findUnique({
            where: { username: "admin" }
        });

        if (!existingAdmin) {
            // Only create admin if it doesn't exist and an initial password is configured
            if (!adminPassword) {
                return NextResponse.json(
                    { success: false, error: "ADMIN_INITIAL_PASSWORD not configured" },
                    { status: 500 }
                );
            }
            const hashedPassword = await bcrypt.hash(adminPassword, 12);
            await prisma.adminUser.create({
                data: {
                    username: "admin",
                    password: hashedPassword,
                    name: "System Admin",
                    role: "super_admin"
                }
            });
            adminMsg = "Admin user created";
        } else {
            adminMsg = "Admin user already exists, password left unchanged";
        }

        // 3. Products - Manual entry only
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
                        negativeFor: (p as any).negativeFor || [],
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
