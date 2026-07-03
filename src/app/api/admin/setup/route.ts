
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyAdminSession } from "@/lib/admin-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
    try {
        const ip = getClientIP(request);
        const limitResult = await rateLimit(`admin-setup-${ip}`, "default", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!limitResult.success) {
            return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });
        }

        const setupSecret = process.env.SETUP_SECRET;
        if (!setupSecret) {
            return NextResponse.json(
                { success: false, error: "SETUP_SECRET not configured" },
                { status: 500 }
            );
        }

        const adminCount = await prisma.adminUser.count();

        if (adminCount > 0) {
            // Existing admins: require super_admin authentication
            const admin = await verifyAdminSession();
            if (!admin) {
                return NextResponse.json(
                    { success: false, error: "Unauthorized" },
                    { status: 401 }
                );
            }
            if (admin.role !== "super_admin") {
                return NextResponse.json(
                    { success: false, error: "Forbidden - super_admin required" },
                    { status: 403 }
                );
            }
        }

        // Validate setup secret from header only (not body — prevents CSRF)
        let providedSecret: string | null = null;
        const authHeader = request.headers.get("x-setup-secret");
        if (authHeader) {
            providedSecret = authHeader;
        }

        const isSuperAdmin = adminCount > 0;
        const secretValid = typeof providedSecret === "string" && safeTimingEqual(providedSecret, setupSecret);
        if (!isSuperAdmin && !secretValid) {
            return NextResponse.json(
                { success: false, error: "Invalid setup secret" },
                { status: 403 }
            );
        }
        if (isSuperAdmin && providedSecret && !secretValid) {
            return NextResponse.json(
                { success: false, error: "Invalid setup secret" },
                { status: 403 }
            );
        }

        // 2. Admin - Only create if not exists, NEVER reset existing password
        const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
        let hashedPassword: string | null = null;

        const existingAdminOutside = await prisma.adminUser.findUnique({
            where: { username: "admin" }
        });
        if (!existingAdminOutside) {
            if (!adminPassword) {
                return NextResponse.json(
                    { success: false, error: "ADMIN_INITIAL_PASSWORD not configured" },
                    { status: 500 }
                );
            }
            hashedPassword = await bcrypt.hash(adminPassword, 12);
        }

        // 3. Products - Manual entry only
        // Wrap seeding in a transaction to avoid duplicate admin/products under concurrency.
        const seedResult = await prisma.$transaction(async (tx) => {
            let adminMsg: string;
            const existingAdmin = await tx.adminUser.findUnique({
                where: { username: "admin" }
            });

            if (!existingAdmin) {
                // hashedPassword is guaranteed non-null here because of the outside check
                await tx.adminUser.create({
                    data: {
                        username: "admin",
                        password: hashedPassword!,
                        name: "System Admin",
                        role: "super_admin"
                    }
                });
                adminMsg = "Admin user created";
            } else {
                adminMsg = "Admin user already exists, password left unchanged";
            }

            const productCount = await tx.product.count();

            return { adminMsg, productCount };
        });

        const { adminMsg, productCount } = seedResult;

        return NextResponse.json({
            success: true,
            messages: [adminMsg, `Found ${productCount} existing products.`]
        });

    } catch (error) {
        console.error("Setup failed:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

function safeTimingEqual(a: string, b: string): boolean {
    // 填充到相同长度后再做常量时间比较，避免泄露 secret 长度
    const maxLen = Math.max(a.length, b.length);
    const paddedA = a.padEnd(maxLen, '\0');
    const paddedB = b.padEnd(maxLen, '\0');
    try {
        return crypto.timingSafeEqual(Buffer.from(paddedA), Buffer.from(paddedB));
    } catch {
        return false;
    }
}
