import type { ComprehensiveResult } from "@/lib/analysis-result";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";

/**
 * Mock 数据：仅用于 /result?status=analyzing&mock=true 本地预览结果页 UI
 */

export const MOCK_RESULT: ComprehensiveResult = {
    skinProfile: {
        type: "sensitive",
        typeLabel: "敏敏派 · 敏感型肌肤",
        concerns: ["屏障薄弱", "泛红易敏", "换季不稳定"],
        skinAge: 24,
    },
    analysis: {
        summary:
            "您的肌肤整体状态良好，属于典型的敏感型肌肤。屏障功能偏薄，对外界刺激反应敏锐，但修护潜力很大。当前最需要的是建立稳定的屏障修护节奏，精简护肤步骤，避免功效叠加带来的负担。",
        details: [
            "面部整体肤色均匀度较好，但两颊可见轻度泛红，提示毛细血管反应性偏高。T 区水油平衡尚可，鼻翼两侧有轻微毛孔粗大迹象。",
            "角质层屏障偏薄，锁水能力中等偏下，干燥环境下容易出现紧绷感。",
            "眼周状态良好，无明显细纹，但存在轻度暗沉，与作息规律性相关。",
            "光老化程度较低，说明日常防晒习惯有效，建议继续保持。",
        ],
        lifestyleTips: [
            "保持规律作息，23:00 前入睡有助于屏障自我修护。",
            "换季前 2 周提前切换为精简护肤方案，降低敏感爆发概率。",
            "饮食中增加 Omega-3 摄入（深海鱼、亚麻籽），有助于改善肌肤炎症反应。",
        ],
    },
    products: [
        {
            id: "mock-cleanser",
            name: "氨基酸温和洁面乳",
            category: "洁面",
            reason: "氨基酸体系 pH5.5 弱酸性，清洁力适中不伤屏障，是敏感肌晨间洁面的安全选择。",
            image: "/images/products/Foam Cleanser.svg",
            price: "¥89",
            keyIngredients: ["氨基酸表活", "泛醇 B5", "甘油"],
            benefits: ["温和清洁", "不紧绷", "屏障友好"],
            source: "persona",
        },
        {
            id: "mock-serum",
            name: "神经酰胺屏障修护精华",
            category: "精华",
            reason: "神经酰胺 + 胆固醇 + 脂肪酸 3:1:1 黄金配比，模拟皮脂膜结构，直接修补屏障缺口。",
            image: "/images/products/Serum.svg",
            price: "¥168",
            keyIngredients: ["神经酰胺 NP", "积雪草提取物", "透明质酸钠"],
            benefits: ["屏障修护", "舒缓泛红", "深层锁水"],
            source: "persona",
        },
        {
            id: "mock-cream",
            name: "舒缓修护面霜",
            category: "面霜",
            reason: "100% 无水纯净配方，成分表仅 11 项，最大限度降低刺激风险，夜间封层锁住修护成果。",
            image: "/images/products/Face Cream.svg",
            price: "¥139",
            keyIngredients: ["角鲨烷", "红没药醇", "尿囊素"],
            benefits: ["夜间修护", "精简配方", "长效保湿"],
            source: "persona",
        },
        {
            id: "mock-sunscreen",
            name: "物理防晒乳 SPF50+",
            category: "防晒",
            reason: "纯物理防晒剂（氧化锌 + 二氧化钛），不被皮肤吸收，敏感肌日间防护的第一选择。",
            image: "/images/products/Sunscreen.svg",
            price: "¥128",
            keyIngredients: ["氧化锌", "二氧化钛", "维生素 E"],
            benefits: ["高倍防护", "物理防晒", "不刺激"],
            source: "persona",
        },
    ],
    dataSource: "comprehensive",
    persona: "sensitive",
};

export const MOCK_FACE_ANALYSIS: FaceAnalysisResult = {
    skinType: {
        type: "sensitive",
        confidence: 0.87,
        description: "敏感型肌肤，屏障偏薄，易泛红",
    },
    skinAge: {
        estimated: 24,
        factors: ["光老化程度低", "弹性良好", "眼周无明显细纹"],
    },
    gender: { value: "female", confidence: 0.92 },
    dimensions: {
        waterOil: { score: 68, percentile: 62, grade: "good", details: "T 区轻微偏油，两颊偏干" },
        skinTone: { score: 74, percentile: 70, grade: "good", details: "整体均匀，两颊轻度泛红" },
        spots: { score: 82, percentile: 78, grade: "excellent", details: "未见明显色斑" },
        wrinkles: { score: 85, percentile: 80, grade: "excellent", details: "无明显细纹" },
        uvDamage: { score: 79, percentile: 75, grade: "good", details: "光老化程度较低" },
        sensitivity: { score: 45, percentile: 38, grade: "fair", details: "屏障偏薄，易受刺激" },
        darkCircles: { score: 62, percentile: 55, grade: "good", details: "轻度暗沉" },
        firmness: { score: 80, percentile: 76, grade: "good", details: "弹性良好" },
        acne: { score: 76, percentile: 72, grade: "good", details: "鼻翼轻微毛孔粗大" },
        radiance: { score: 71, percentile: 66, grade: "good", details: "光泽度中等偏上" },
    },
    overallScore: 72,
    summary:
        "您的肌肤综合评分 72 分，整体状态良好。敏感维度是当前最需要关注的短板，建议以屏障修护为核心策略，配合精简护肤流程，预计 4-6 周可见明显改善。",
    recommendations: [
        "早晚使用氨基酸系温和洁面，水温控制在 32-35°C。",
        "护肤步骤精简至 3 步以内：洁面 → 修护精华 → 面霜/防晒。",
        "每周使用 1-2 次含神经酰胺的修护面膜，强化屏障。",
        "避免含酒精、香精、高浓度果酸的产品。",
        "坚持每日防晒，优先选择纯物理防晒剂产品。",
    ],
    skinConditions: [
        {
            condition: "面部泛红",
            severity: "mild",
            area: "两颊",
            description: "毛细血管反应性偏高，温度变化时明显",
        },
        {
            condition: "屏障受损",
            severity: "mild",
            area: "全脸",
            description: "角质层偏薄，锁水能力中等偏下",
        },
    ],
    zoneAnalysis: {
        forehead: { condition: "状态稳定，无明显问题", advice: "维持当前护理节奏即可", oil: 45, texture: 78 },
        tZone: { condition: "鼻翼两侧毛孔轻微粗大", advice: "温和清洁，避免过度去脂", oil: 62, texture: 70 },
        leftCheek: { condition: "轻度泛红，屏障偏薄", advice: "重点修护区域，加强保湿封层", redness: 48, texture: 65 },
        rightCheek: { condition: "轻度泛红，与左颊对称", advice: "同左颊护理策略", redness: 45, texture: 67 },
        eyeArea: { condition: "轻度暗沉", advice: "规律作息，可搭配咖啡因眼霜", darkCircles: 40 },
        jawline: { condition: "状态良好", advice: "注意卸妆彻底，避免残留", texture: 80 },
    },
};
