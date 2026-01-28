/**
 * 产品数据迁移脚本
 * 为现有产品补充 step 字段
 * 
 * 运行方式: npx tsx scripts/migrate-product-steps.ts
 */

import prisma from '../src/lib/prisma';

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

async function migrateProductSteps() {
    console.log('🚀 开始迁移产品 step 字段...\n');

    try {
        // 获取所有产品
        const products = await prisma.product.findMany();

        console.log(`📦 发现 ${products.length} 个产品\n`);

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
                console.log(`  ✅ ${product.name} → ${step}`);
                updated++;
            } else {
                console.log(`  ⚠️ ${product.name} (${product.category}) - 无法识别分类，跳过`);
                skipped++;
            }
        }

        console.log('\n----------------------------');
        console.log(`✅ 更新成功: ${updated} 个`);
        console.log(`⏭️ 已设置: ${alreadySet} 个`);
        console.log(`⚠️ 跳过: ${skipped} 个`);
        console.log('----------------------------\n');

        if (skipped > 0) {
            console.log('💡 提示: 跳过的产品需要手动在后台设置 step 字段');
        }

    } catch (error) {
        console.error('❌ 迁移失败:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

migrateProductSteps();
