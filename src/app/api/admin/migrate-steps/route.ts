import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 分类到步骤的映射
const CATEGORY_TO_STEP: Record<string, string> = {
    '洁面': 'cleanser',
    '洁面乳': 'cleanser',
    '洗面奶': 'cleanser',
    '卸妆': 'cleanser',
    '化妆水': 'toner',
    '爽肤水': 'toner',
    '柔肤水': 'toner',
    '精华液': 'essence',
    '精华': 'serum',
    '安瓶': 'serum',
    '眼霜': 'eye_cream',
    '眼部精华': 'eye_cream',
    '面霜': 'cream',
    '乳液': 'cream',
    '保湿霜': 'cream',
    '防晒': 'sunscreen',
    '防晒霜': 'sunscreen',
    '隔离': 'sunscreen',
    '面膜': 'mask',
    '护肤油': 'oil',
    '精油': 'oil'
};

// POST /api/admin/migrate-steps - 迁移产品 step 字段
export async function POST(request: NextRequest) {
    try {
        // 获取所有产品
        const products = await prisma.product.findMany();

        let updated = 0;
        let skipped = 0;
        let alreadySet = 0;

        for (const product of products) {
            // 如果已经有 step，跳过
            if (product.step) {
                alreadySet++;
                continue;
            }

            const step = CATEGORY_TO_STEP[product.category];

            if (step) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: { step }
                });
                updated++;
            } else {
                skipped++;
            }
        }

        return NextResponse.json({
            message: 'Migration completed',
            stats: {
                total: products.length,
                updated,
                alreadySet,
                skipped
            }
        });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
    }
}

// GET - 获取迁移状态
export async function GET() {
    try {
        const products = await prisma.product.findMany({
            select: {
                id: true,
                name: true,
                category: true,
                step: true
            }
        });

        const withStep = products.filter(p => p.step);
        const withoutStep = products.filter(p => !p.step);

        return NextResponse.json({
            total: products.length,
            withStep: withStep.length,
            withoutStep: withoutStep.length,
            needsMigration: withoutStep.map(p => ({
                id: p.id,
                name: p.name,
                category: p.category,
                suggestedStep: CATEGORY_TO_STEP[p.category] || null
            }))
        });
    } catch (error) {
        console.error('Check migration status error:', error);
        return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
    }
}
