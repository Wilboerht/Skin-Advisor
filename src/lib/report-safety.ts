/**
 * 报告「安全与成分」面板数据：由问卷 + 推荐产品确定性生成，不额外调用 AI。
 *
 * 注意：这里只产出可公开展示的摘要，不回传原始过敏史/孕期/用药字段；
 * 报告页通过 analysisResult.safetyNotes 读取。
 */

export interface SafetyNotes {
    /** 因过敏史/孕期排除或需要避开的成分 */
    excluded: string[];
    /** 当前推荐组合中的活性成分 */
    actives: string[];
    /** 叠加/使用禁忌 */
    conflicts: string[];
    /** 建立耐受/斑贴测试建议 */
    patchTest: string;
    /** 防晒要求 */
    sunProtection: string;
    /** 需要就医的边界（来自中度/重度问题的 medicalBoundary） */
    whenToSeeDoctor: string[];
}

export interface SafetyInput {
    allergies?: string | string[];
    pregnancyStatus?: string;
    medicationHistory?: string;
    medicalBeauty?: string;
    skincareLevel?: string;
    products?: Array<{ keyIngredients?: string[] | null }>;
    issues?: Array<{ severity?: string; medicalBoundary?: string }>;
}

const ALLERGY_LABELS: Record<string, string> = {
    none: "无过敏史",
    fragrance: "香精",
    alcohol: "酒精",
    acids: "酸类（如水杨酸、果酸）",
    multiple: "多种成分",
    unknown: "不确定具体成分",
};

const PREGNANCY_EXCLUDED = [
    "精油类（迷迭香叶油、檀香油、乳香油、葡萄柚籽提取物等）",
    "香精/Fragrance（孕期优先选择无香精版本）",
];

const GENERIC_DOCTOR_ADVICE =
    "如出现持续红肿、刺痛、渗出、皮疹加重或自行护理 2 周无改善，请及时到皮肤科面诊。";

function normalizeList(value: string | string[] | undefined): string[] {
    if (!value) return [];
    const list = Array.isArray(value) ? value : [value];
    return list.map((item) => String(item).trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function hasAny(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
}

export function buildSafetyNotes(input: SafetyInput): SafetyNotes {
    const excluded: string[] = [];
    const conflicts: string[] = [];
    const actives = unique(
        (input.products ?? [])
            .flatMap((product) => (Array.isArray(product.keyIngredients) ? product.keyIngredients : []))
            .map((item) => item.trim())
            .filter(Boolean)
    ).slice(0, 10);

    const allergyList = normalizeList(input.allergies).filter((item) => item !== "none");
    for (const allergy of allergyList) {
        const label = ALLERGY_LABELS[allergy] || allergy;
        if (label === "不确定具体成分") {
            excluded.push("未明确的过敏成分（首次使用新产品先做斑贴测试）");
        } else {
            excluded.push(label);
        }
    }

    const pregnancy = input.pregnancyStatus;
    if (pregnancy === "yes" || pregnancy === "unknown") {
        excluded.push(...PREGNANCY_EXCLUDED);
        conflicts.push("孕期/哺乳期/备孕期优先精简护理，新增活性成分前建议先咨询医生。");
    }

    const activesText = actives.join("、");
    if (hasAny(activesText, ["壬二酸", "乳酸", "水杨酸", "果酸"])) {
        conflicts.push("酸类与高浓度维C建议分开时段使用；初次使用从每周 2 次开始，避免与磨砂/清洁面膜同日叠加。");
    }
    if (input.medicalBeauty && input.medicalBeauty !== "none") {
        conflicts.push("近 3 个月有医美/刷酸史：术后 7–14 天以修护+防晒为主，暂停酸类与多重功效叠加。");
    }
    if (input.skincareLevel === "beginner") {
        conflicts.push("护肤新手：一次只新增 1 个活性成分，观察 1–2 周无不适后再叠加下一个。");
    }
    if (input.medicationHistory && input.medicationHistory !== "none") {
        conflicts.push("正在用药：如出现刺痛、脱屑或泛红加重，先停用活性成分并咨询医生。");
    }

    const sunProtection = hasAny(activesText, ["壬二酸", "乳酸", "烟酰胺", "熊果苷", "抗坏血酸", "光甘草定"])
        ? "白天使用酸类/美白成分时，配合 SPF30+ 防晒并避免暴晒；阴天与室内靠窗位置同样需要防晒。"
        : "日常坚持 SPF30+ 防晒，户外每 2–3 小时补涂。";

    const whenToSeeDoctor = unique(
        (input.issues ?? [])
            .filter((issue) => issue.severity === "moderate" || issue.severity === "severe")
            .map((issue) => (issue.medicalBoundary || "").trim())
            .filter(Boolean)
    ).slice(0, 3);

    return {
        excluded: unique(excluded),
        actives,
        conflicts: unique(conflicts),
        patchTest: "首次使用新产品前，先在耳后或下颌线小面积试用 24–48 小时；无刺痛、泛红、瘙痒再上脸。",
        sunProtection,
        whenToSeeDoctor: whenToSeeDoctor.length > 0 ? whenToSeeDoctor : [GENERIC_DOCTOR_ADVICE],
    };
}
