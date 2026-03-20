/**
 * Helper to get advice based on dimension and score
 */
export const DIMENSION_ADVICE: Record<string, { high: string, medium: string, low: string }> = {
    waterOil: {
        high: "水油平衡极佳，既不干燥也不油腻。",
        medium: "局部（如T区）出油或脸颊偏干，建议分区护理。",
        low: "水油严重失衡，可能伴有外油内干或极度干燥脱皮。"
    },
    skinTone: {
        high: "肤色均匀透亮，无明显色差。",
        medium: "嘴角、眼周或鼻翼有轻微暗沉，注意局部提亮。",
        low: "肤色不均明显，可能伴有黄气或色素沉积，建议使用美白抗氧化产品。"
    },
    spots: {
        high: "您的肤色非常均匀，继续保持防晒即可。",
        medium: "局部有少量色斑沉着，建议使用含有烟酰胺或维C的护肤品。",
        low: "明显色斑沉着，建议加强防晒，并考虑使用美白精华或咨询医美项目。"
    },
    wrinkles: {
        high: "肌肤紧致饱满，无明显皱纹。",
        medium: "眼周或法令纹处有轻微干纹，注意保湿和抗初老。",
        low: "深层动态纹明显，建议使用视黄醇（A醇）类产品并配合按摩。"
    },
    uvDamage: {
        high: "由于您防护得当，深层光老化程度很低。",
        medium: "皮下有隐形晒斑，紫外线已经造成了轻微损伤，务必坚持每日防晒。",
        low: "深层光损伤严重，未来色斑爆发风险高，必须严格防表硬防晒。"
    },
    sensitivity: { // Was redAreas
        high: "肌肤屏障强韧，无泛红现象。",
        medium: "两颊或鼻翼有轻微泛红，换季时需注意维稳。",
        low: "肌肤处于敏感或炎症状态，建议精简护肤，使用含有积雪草或B5的修护产品。"
    },
    darkCircles: {
        high: "眼周明亮，无黑眼圈困扰。",
        medium: "因熬夜或疲劳出现轻微黑眼圈，建议热敷和规律作息。",
        low: "结构型或血管型黑眼圈明显，建议使用含咖啡因眼霜或视黄醇眼霜。"
    },
    firmness: {
        high: "胶原蛋白充足，轮廓线清晰紧致。",
        medium: "面部轮廓轻微松弛，可能有初老迹象。",
        low: "松弛下垂明显，建议使用多肽类抗老产品或提拉仪器。"
    },
    acne: { // Was acneRisk
        high: "油脂分泌平衡，不易长痘。",
        medium: "T区油脂分泌较旺，有闭口粉刺风险，建议定期做清洁面膜。",
        low: "紫质检测显示痤疮丙酸杆菌活跃，痘痘爆发风险高，建议使用祛痘产品。"
    },
    radiance: {
        high: "自带光泽感，肌肤通透水润。",
        medium: "光泽度一般，可能因为缺水或角质氧化。",
        low: "皮肤暗沉无光，看起来疲惫，建议去角质并加强抗氧化。"
    }
};

export function getDimensionAdvice(key: string, score: number): string {
    const adviceSet = DIMENSION_ADVICE[key];
    if (!adviceSet) return "建议保持良好的作息与护肤习惯。";

    if (score >= 80) return adviceSet.high;
    if (score >= 60) return adviceSet.medium;
    return adviceSet.low;
}
