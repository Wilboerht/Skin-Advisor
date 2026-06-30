/**
 * 一次性初始化 8 派形象的产品推荐规则
 * 使用方法: npx tsx scripts/seed-persona-rules.ts
 *
 * 按产品名称在数据库中查找 ID，自动关联到各 IP 形象规则
 */

import prisma from "../src/lib/prisma";

/* ================================================================
   数据库中的产品名称（确保与 product.name 一致）
   ================================================================ */

const PRODUCT_NAMES = {
    cloud_cleanser:      "云朵洁面",
    white_magic_cream:   "白魔法面霜",
    egg_sunscreen:       "蛋定防晒",
    guardian_mask:       "守护面膜",
    green_magic_oil:     "绿魔法臻萃呵护美容油",
    youth_essence:       "童颜精华",
    obsidian_scrub:      "黑曜磨砂膏",
} as const;

/* ================================================================
   每个 IP 形象的 入门必入 产品组合
   ================================================================ */

const PERSONA_ENTRY: Record<string, string[]> = {
    // 敏敏派：守护面膜 + 绿魔法臻萃呵护美容油
    sensitive:   ["guardian_mask", "green_magic_oil"],
    // 极简派：绿魔法臻萃呵护美容油
    minimalist:  ["green_magic_oil"],
    // 守护派：云朵洁面 + 白魔法面霜 + 蛋定防晒
    guardian:    ["cloud_cleanser", "white_magic_cream", "egg_sunscreen"],
    // 沙漠派：云朵洁面 + 白魔法面霜 + 蛋定防晒
    desert:      ["cloud_cleanser", "white_magic_cream", "egg_sunscreen"],
    // 油条派：云朵洁面 + 守护面膜 + 蛋定防晒
    oily:        ["cloud_cleanser", "guardian_mask", "egg_sunscreen"],
    // 混合派：云朵洁面 + 白魔法面霜 + 蛋定防晒
    combination: ["cloud_cleanser", "white_magic_cream", "egg_sunscreen"],
    // 冻龄派：云朵洁面 + 童颜精华 + 白魔法面霜 + 蛋定防晒
    ageless:     ["cloud_cleanser", "youth_essence", "white_magic_cream", "egg_sunscreen"],
    // 奢华派：云朵洁面 + 童颜精华 + 白魔法面霜 + 蛋定防晒
    luxury:      ["cloud_cleanser", "youth_essence", "white_magic_cream", "egg_sunscreen"],
};

const LABELS: Record<string, string> = {
    sensitive: "敏敏派", minimalist: "极简派", luxury: "奢华派",
    ageless: "冻龄派", desert: "沙漠派", oily: "油条派",
    combination: "混合派", guardian: "守护派",
};

async function main() {
    console.log("🌱 开始创建 8 派形象推荐规则...\n");

    // 1. 一次性查询产品名称 → ID
    const allNames = Object.values(PRODUCT_NAMES);
    const dbProducts = await prisma.product.findMany({
        where: { name: { in: allNames }, active: true },
        select: { id: true, name: true },
    });
    const nameToId = new Map(dbProducts.map(p => [p.name, p.id]));

    for (const name of allNames) {
        if (!nameToId.has(name)) console.warn(`⚠️  产品 "${name}" 未找到`);
    }
    console.log(`📦 ${nameToId.size}/${allNames.length} 个产品就绪\n`);

    // 2. 逐 persona 创建规则
    for (const [key, pKeys] of Object.entries(PERSONA_ENTRY)) {
        const label = LABELS[key] || key;
        const ids = pKeys.map(k => nameToId.get(PRODUCT_NAMES[k as keyof typeof PRODUCT_NAMES])).filter(Boolean) as string[];

        if (ids.length !== pKeys.length) {
            const missing = pKeys.filter(k => !nameToId.get(PRODUCT_NAMES[k as keyof typeof PRODUCT_NAMES]));
            console.warn(`⚠️  ${label} — 缺失: ${missing.map(k => PRODUCT_NAMES[k as keyof typeof PRODUCT_NAMES]).join("、")}`);
            continue;
        }

        const exists = await prisma.recommendationRule.findFirst({
            where: { conditions: { equals: { persona: [key] } } },
        });
        if (exists) {
            console.log(`⏭️  ${label} — 已存在，跳过`);
            continue;
        }

        await prisma.recommendationRule.create({
            data: {
                name: `${label} 入门必入方案`,
                priority: 100,
                conditions: { persona: [key] },
                active: true,
                products: { create: ids.map(id => ({ productId: id })) },
            },
        });
        console.log(`✅ ${label} — ${ids.length} 产品`);
    }
    console.log("\n🎉 完成！");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
