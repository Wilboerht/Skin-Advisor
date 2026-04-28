/**
 * 推荐逻辑功能测试脚本
 * 运行: npx tsx scripts/test-recommendations.ts
 */

// ========== 测试 identifyConcerns ==========
import { identifyConcerns, getConcernLabel } from "../src/lib/advisor-utils";

console.log("=== 测试 identifyConcerns ===\n");

// 测试1: 只有问卷关注点
const concerns1 = identifyConcerns({ primaryConcern: "acne", skinType: "oily" });
console.log("问卷关注点 acne:", concerns1, "→ 标签:", concerns1.map(getConcernLabel));
console.assert(concerns1.includes("acne"), "❌ 应该包含 acne");

// 测试2: 面部分析维度评分低
const mockFaceAnalysis = {
  skinType: { type: "oily", confidence: 0.9 },
  dimensions: {
    wrinkles: { score: 45, grade: "fair", details: "有细纹" },
    spots: { score: 80, grade: "good", details: "少量色斑" },
    waterOil: { score: 40, grade: "poor", details: "T区出油" },
    acne: { score: 35, grade: "poor", details: "痘痘较多" },
    uvDamage: { score: 50, grade: "fair", details: "光损伤" },
    sensitivity: { score: 70, grade: "average", details: "轻微敏感" },
    radiance: { score: 55, grade: "fair", details: "暗沉" },
    darkCircles: { score: 45, grade: "fair", details: "黑眼圈" },
    firmness: { score: 50, grade: "fair", details: "弹性下降" },
    skinTone: { score: 52, grade: "fair", details: "肤色不均" },
  },
  skinConditions: [
    { condition: "毛孔粗大", severity: "moderate" as const, area: "T区", description: "毛孔明显" },
    { condition: "光老化", severity: "severe" as const, area: "全脸", description: "紫外线损伤" },
  ],
  labAnalysis: {
    roughness: { value: 18, unit: "µm", status: "粗糙" },
  },
  zoneAnalysis: {
    forehead: { condition: "出油", advice: "控油", texture: 40 },
    tZone: { condition: "出油旺盛", advice: "清洁", texture: 35 },
    leftCheek: { condition: "正常", advice: "保湿", texture: 85 },
    rightCheek: { condition: "正常", advice: "保湿", texture: 85 },
    eyeArea: { condition: "黑眼圈", advice: "眼霜", texture: 70 },
    jawline: { condition: "紧致", advice: "按摩", texture: 80 },
  },
  overallScore: 55,
  summary: "测试",
  recommendations: [],
  skinAge: { estimated: 28, factors: [] },
  hydration: { level: "low", description: "缺水" },
};

const concerns2 = identifyConcerns({ primaryConcern: "dryness", skinType: "dry" }, mockFaceAnalysis as any);
console.log("\n面部分析 + 问卷 dryness:", concerns2, "→ 标签:", concerns2.map(getConcernLabel));
console.assert(concerns2.includes("wrinkles"), "❌ 应该包含 wrinkles (wrinkles.score=45<60)");
console.assert(concerns2.includes("waterOil"), "❌ 应该包含 waterOil (waterOil.score=40<60)");
console.assert(concerns2.includes("acne"), "❌ 应该包含 acne (acne.score=35<60)");
console.assert(concerns2.includes("anti_aging"), "❌ 应该包含 anti_aging (uvDamage.score=50<60)");
console.assert(concerns2.includes("dullness"), "❌ 应该包含 dullness (radiance.score=55<60)");
console.assert(concerns2.includes("dark_circles"), "❌ 应该包含 dark_circles (darkCircles.score=45<60)");
console.assert(concerns2.includes("roughness"), "❌ 应该包含 roughness (labAnalysis.roughness=18>15)");
console.assert(concerns2.includes("dryness"), "❌ 应该包含 dryness (问卷)");

// 测试3: 无问卷、无面部分析 → 默认 hydration
const concerns3 = identifyConcerns({});
console.assert(concerns3.includes("hydration"), "❌ 默认应该包含 hydration");
console.log("\n无输入默认关注点:", concerns3, "→ 标签:", concerns3.map(getConcernLabel));

// ========== 测试功效映射匹配 ==========
console.log("\n=== 测试功效映射匹配 ===\n");

const CONCERN_TO_BENEFITS: Record<string, string[]> = {
  anti_aging: ["抗老", "抗初老", "紧致", "抗皱", "胶原", "弹力", "年轻", "修护光损伤", "抗氧化"],
  fine_lines: ["淡纹", "抗皱", "平滑", "抚纹"],
  dullness: ["提亮", "提亮肤色", "亮白", "焕亮", "光泽", "透亮", "均匀肤色"],
  pigmentation: ["淡斑", "美白", "均匀", "去印", "焕白", "淡化痘印"],
  hydration: ["补水", "保湿", "锁水", "滋润", "水润", "润泽", "微补水"],
  sensitivity: ["舒缓", "舒缓褪红", "修护", "修护屏障", "镇静", "敏感", "温和", "屏障", "修护皮脂膜"],
  acne: ["祛痘", "净痘", "控痘", "消炎", "净化", "调理", "控油"],
  aging: ["抗老", "抗初老", "紧致", "抗皱", "修护光损伤", "抗氧化"],
  wrinkles: ["淡纹", "抗皱", "平滑"],
  spots: ["淡斑", "美白", "淡化痘印"],
  dryness: ["补水", "保湿", "滋润", "微补水", "修护皮脂膜", "以油养肤"],
  oil_control: ["控油", "清爽", "平衡"],
  dark_circles: ["眼周", "眼部", "黑眼圈", "眼袋"],
  roughness: ["改善粗糙", "平滑", "细致"],
  waterOil: ["平衡", "调理", "控油", "补水"],
};

// 测试品牌功效匹配
const testProducts = [
  { name: "抗初老精华", benefits: ["抗初老", "修护光损伤", "抗氧化"] },
  { name: "修护屏障霜", benefits: ["舒缓褪红", "修护屏障", "保湿"] },
  { name: "提亮精华", benefits: ["提亮肤色", "保湿", "舒缓", "淡化痘印"] },
  { name: "精华油", benefits: ["滋润", "修护皮脂膜", "抗氧化", "以油养肤"] },
  { name: "洁面", benefits: ["温和清洁", "洗去防晒", "微补水", "不假滑"] },
];

for (const product of testProducts) {
  const matchedConcerns: string[] = [];
  for (const [concern, keywords] of Object.entries(CONCERN_TO_BENEFITS)) {
    const hasMatch = product.benefits.some((b: string) =>
      keywords.some((k: string) => b.includes(k))
    );
    if (hasMatch) matchedConcerns.push(concern);
  }
  console.log(`${product.name}: 命中关切点 [${matchedConcerns.join(", ")}]`);
}

// ========== 测试负面过滤 ==========
console.log("\n=== 测试负面过滤 ===\n");

function testNegativeScore(concerns: string[], skinType: string, negativeTags: string[], productBenefits: string[]): number {
  let score = 0;
  const reasons: string[] = [];

  // 模拟关切匹配
  concerns.forEach((concern) => {
    const relatedBenefits = CONCERN_TO_BENEFITS[concern] || [];
    relatedBenefits.forEach((benefit) => {
      if (productBenefits.some((b: string) => b.includes(benefit))) {
        score += 30;
      }
    });
  });

  // 负面标签
  const skinTypeNegativeMap: Record<string, string[]> = {
    dry: ["干皮", "干性", "干燥肌"],
    oily: ["油皮", "油性", "痘痘肌", "致痘"],
    sensitive: ["敏感肌", "敏感", "刺激", "酒精"],
    combination: ["闷痘", "厚重"],
  };
  const skinNegatives = skinTypeNegativeMap[skinType] || [];
  if (skinNegatives.some(tag => negativeTags.includes(tag))) {
    score -= 300;
    reasons.push("⚠️ 不适合您的肤质");
  }
  if (concerns.includes("acne") && negativeTags.some(t => ["致痘", "痘痘肌", "闷痘"].includes(t))) {
    score -= 300;
  }

  // Base Score fallback
  const hasNegativeReason = reasons.some(r => r.includes("不适合"));
  if (score < 0) score = 0;
  if (score === 0 && !hasNegativeReason) score = 10;

  return score;
}

// 场景A: 有害产品（致痘 + 痘痘用户）
const scoreA = testNegativeScore(["acne"], "oily", ["致痘"], []);
console.log(`有害产品(致痘+痘痘用户): 分数=${scoreA}`);
console.assert(scoreA === 0, "❌ 有害产品应该得0分");

// 场景B: 无害产品（无匹配）
const scoreB = testNegativeScore(["acne"], "oily", [], []);
console.log(`无害产品(无匹配): 分数=${scoreB}`);
console.assert(scoreB === 10, "❌ 无害无匹配产品应该得10分基础分");

// 场景C: 好产品（控油匹配 + 痘痘用户）
const scoreC = testNegativeScore(["acne"], "oily", [], ["控油平衡", "祛痘精华"]);
console.log(`好产品(控油匹配+痘痘用户): 分数=${scoreC}`);
console.assert(scoreC > 10, "❌ 好产品应该有正分");

// ========== 测试价格解析 ==========
console.log("\n=== 测试价格解析 ===\n");

function parsePrice(price: string): number {
  const priceMatch = String(price).match(/[0-9]+(?:\.[0-9]+)?/);
  return priceMatch ? Number(priceMatch[0]) : 0;
}

const priceTests = [
  { input: "¥890", expected: 890 },
  { input: "¥1000-2000", expected: 1000 },
  { input: "¥599.00", expected: 599 },
  { input: "价格待定", expected: 0 },
];

for (const t of priceTests) {
  const result = parsePrice(t.input);
  const pass = result === t.expected;
  console.log(`"${t.input}" → ${result} (期望 ${t.expected}) ${pass ? "✅" : "❌"}`);
  console.assert(pass, `❌ 价格解析错误: ${t.input}`);
}

console.log("\n=== 所有测试完成 ===");
