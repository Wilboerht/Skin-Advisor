
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminSession, logAdminAction, getClientInfo } from "@/lib/admin-auth";

// POST - Batch operations on products
export async function POST(request: NextRequest) {
    try {
        const admin = await verifyAdminSession();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { ids, action } = body;
        const clientInfo = getClientInfo(request);

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { success: false, error: "No product IDs provided" },
                { status: 400 }
            );
        }

        // Batch size limit to prevent accidental mass operations
        const MAX_BATCH_SIZE = 100;
        if (ids.length > MAX_BATCH_SIZE) {
            return NextResponse.json(
                { success: false, error: `Batch size exceeds limit of ${MAX_BATCH_SIZE}` },
                { status: 400 }
            );
        }

        // Validate all IDs are strings
        if (!ids.every((id: any) => typeof id === 'string' && id.length > 0)) {
            return NextResponse.json(
                { success: false, error: "Invalid ID format" },
                { status: 400 }
            );
        }

        const validActions = ['activate', 'deactivate', 'feature', 'unfeature', 'delete'];
        if (!validActions.includes(action)) {
            return NextResponse.json(
                { success: false, error: "Invalid action" },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case 'activate':
                result = await prisma.product.updateMany({
                    where: { id: { in: ids } },
                    data: { active: true }
                });
                break;

            case 'deactivate':
                result = await prisma.product.updateMany({
                    where: { id: { in: ids } },
                    data: { active: false }
                });
                break;

            case 'feature':
                result = await prisma.product.updateMany({
                    where: { id: { in: ids } },
                    data: { featured: true }
                });
                break;

            case 'unfeature':
                result = await prisma.product.updateMany({
                    where: { id: { in: ids } },
                    data: { featured: false }
                });
                break;

            case 'delete':
                result = await prisma.product.deleteMany({
                    where: { id: { in: ids } }
                });

                // 清理 RecommendationRule 中引用的已删除产品 ID
                const deletedIdSet = new Set<string>(ids);
                const rules = await prisma.recommendationRule.findMany();
                for (const rule of rules) {
                    const ruleProductIds = Array.isArray(rule.productIds)
                        ? rule.productIds as string[]
                        : [];
                    const cleanedIds = ruleProductIds.filter(id => !deletedIdSet.has(id));
                    if (cleanedIds.length !== ruleProductIds.length) {
                        await prisma.recommendationRule.update({
                            where: { id: rule.id },
                            data: { productIds: cleanedIds }
                        });
                    }
                }
                break;
        }

        // Log audit
        await logAdminAction({
            adminId: admin.adminId,
            action: `batch_${action}`,
            resource: "Product",
            details: {
                affectedIds: ids,
                count: result?.count || 0
            },
            ...clientInfo
        });

        return NextResponse.json({
            success: true,
            affected: result?.count || 0
        });

    } catch (error) {
        console.error("Batch operation failed:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
