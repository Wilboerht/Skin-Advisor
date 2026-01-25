/**
 * Helper to get advice based on dimension and score
 */
export const DIMENSION_ADVICE: Record<string, { high: string, medium: string, low: string }> = {
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
    texture: {
        high: "皮肤触感细腻光滑。",
        medium: "局部（如鼻翼两侧）有些许粗糙，建议定期温和去角质。",
        low: "角质层堆积较厚，皮肤粗糙，建议刷酸焕肤或使用磨砂类产品。"
    },
    pores: {
        high: "毛孔细腻隐形，堪比婴儿肌。",
        medium: "T区毛孔肉眼可见，建议使用控油收敛水，做好清洁。",
        low: "毛孔粗大明显，可能伴有黑头，建议使用水杨酸疏通毛孔。"
    },
    uvDamage: {
        high: "由于您防护得当，深层光老化程度很低。",
        medium: "皮下有隐形晒斑，紫外线已经造成了轻微损伤，务必坚持每日防晒。",
        low: "深层光损伤严重，未来色斑爆发风险高，必须严格防表硬防晒。"
    },
    brownSpots: {
        high: "深层色素代谢良好。",
        medium: "深层有少量色素淤积，注意内调外养，避免熬夜。",
        low: "深层色素沉着较多，可能会随年龄浮现，建议提前进行抗氧化护理。"
    },
    redAreas: {
        high: "肌肤屏障强韧，无泛红现象。",
        medium: "两颊或鼻翼有轻微泛红，换季时需注意维稳。",
        low: "肌肤处于敏感或炎症状态，建议精简护肤，使用含有积雪草或B5的修护产品。"
    },
    acneRisk: {
        high: "油脂分泌平衡，不易长痘。",
        medium: "T区油脂分泌较旺，有闭口粉刺风险，建议定期做清洁面膜。",
        low: "紫质检测显示痤疮丙酸杆菌活跃，痘痘爆发风险高，建议使用祛痘产品。"
    }
};

export function getDimensionAdvice(key: string, score: number): string {
    const adviceSet = DIMENSION_ADVICE[key];
    if (!adviceSet) return "建议保持良好的作息与护肤习惯。";

    if (score >= 80) return adviceSet.high;
    if (score >= 60) return adviceSet.medium;
    return adviceSet.low;
}
