
import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyAdminSession } from "@/lib/admin-auth";
import { canPerformSystemSetup } from "@/lib/permissions";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
    try {
        const ip = getClientIP(request);
        const limitResult = await rateLimit(`admin-setup-${ip}`, "default", { maxRequests: 5, windowMs: 15 * 60 * 1000 });
        if (!limitResult.success) {
            return apiError(ErrorCode.RATE_LIMITED, "Rate limit exceeded", 429);
        }

        const setupSecret = process.env.SETUP_SECRET;
        if (!setupSecret) {
            return apiError(ErrorCode.INTERNAL_ERROR, "SETUP_SECRET not configured", 500);
        }

        const adminCount = await prisma.adminUser.count();

        if (adminCount > 0) {
            // Existing admins: require super_admin authentication
            const admin = await verifyAdminSession();
            if (!admin) {
                return apiError(ErrorCode.UNAUTHORIZED, "Unauthorized", 401);
            }
            if (!canPerformSystemSetup(admin.role)) {
                return apiError(ErrorCode.FORBIDDEN, "Forbidden - super_admin required", 403);
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
            return apiError(ErrorCode.FORBIDDEN, "Invalid setup secret", 403);
        }
        if (isSuperAdmin && providedSecret && !secretValid) {
            return apiError(ErrorCode.FORBIDDEN, "Invalid setup secret", 403);
        }

        // 2. Admin - Only create if not exists, NEVER reset existing password
        const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
        let hashedPassword: string | null = null;

        const existingAdminOutside = await prisma.adminUser.findUnique({
            where: { username: "admin" }
        });
        if (!existingAdminOutside) {
            if (!adminPassword) {
                return apiError(ErrorCode.INTERNAL_ERROR, "ADMIN_INITIAL_PASSWORD not configured", 500);
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
        logger.error("Setup failed:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Internal server error", 500);
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
