
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { PRODUCTS_CATALOG } from "@/config/products";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
    try {
        const setupSecret = process.env.SETUP_SECRET;
        if (!setupSecret) {
            return NextResponse.json(
                { success: false, error: "SETUP_SECRET not configured" },
                { status: 500 }
            );
        }

        const adminCount = await prisma.adminUser.count();

        if (adminCount > 0) {
            // Existing admins: require authentication
            const admin = await verifyAdminSession();
            if (!admin) {
                return NextResponse.json(
                    { success: false, error: "Unauthorized" },
                    { status: 401 }
                );
            }
        }

        // Validate setup secret from header or body
        let providedSecret: string | null = null;
        const authHeader = request.headers.get("x-setup-secret");
        if (authHeader) {
            providedSecret = authHeader;
        } else {
            try {
                const body = await request.json();
                providedSecret = body?.setupSecret || null;
            } catch {
                // ignore JSON parse errors
            }
        }

        if (!providedSecret || providedSecret !== setupSecret) {
            return NextResponse.json(
                { success: false, error: "Invalid setup secret" },
                { status: 403 }
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
                        category: p.category,
                        image: p.image,
                        price: p.price,
                        description: p.description,
                        keyIngredients: p.keyIngredients,
                        suitableSkinTypes: p.suitableSkinTypes,
                        benefits: p.benefits,
                        negativeFor: (p as any).negativeFor || [],
                        active: true,
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
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
