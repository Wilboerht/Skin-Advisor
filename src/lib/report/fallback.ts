/**
 * 规则模板兜底报告：AI 文案失败时使用，不依赖任何外部模型。
 *
 * 输出仍是现有 ConsultantReport 结构，因此 H5/小程序/后台无需为新失败路径分叉；
 * 同时会写入 reportV3.narrativeSource = "fallback" 供质量看板区分。
 */

import type { ConsultantIssue, ConsultantReport, FaceAnalysisResult } from "@/lib/advisor-utils";
import { DIMENSION_LABELS } from "@/lib/advisor-labels";
import type { DiagnosisResult } from "./diagnosis";
import type { ReportFinding } from "./types";

const DIRECT_CAUSES: Record<string, string> = {
    waterOil: "皮脂分泌与角质层含水量失衡，常见于清洁过度、保湿不足或作息波动。",
    skinTone: "黑色素分布不均、角质代谢变慢或局部炎症后色素沉着。",
    spots: "紫外线累积与局部炎症刺激黑色素细胞，形成可见色沉。",
    wrinkles: "胶原蛋白与弹性纤维流失，加上干燥和表情牵拉形成纹理。",
    uvDamage: "长期紫外线暴露导致胶原降解、色素沉着和屏障受损。",
    sensitivity: "皮肤屏障脂质减少，外界刺激更容易引发泛红、刺痛。",
    darkCircles: "眼周皮肤薄、血管显露，叠加熬夜或色素沉着形成暗沉。",
    firmness: "胶原与弹性纤维支撑力下降，皮肤回弹变慢。",
    acne: "皮脂分泌旺盛、毛囊口角化异常，加上痤疮丙酸杆菌繁殖。",
    radiance: "角质堆积、含水量不足或氧化压力让皮肤失去通透感。",
};

const LIFESTYLE: Record<string, string> = {
    waterOil: "避免过度清洁，早晚温和洁面；室内干燥时使用加湿器。",
    skinTone: "坚持防晒，减少熬夜；每周 1-2 次温和去角质即可。",
    spots: "全年使用 SPF30+ 防晒，户外每 2-3 小时补涂；避免正午暴晒。",
    wrinkles: "保证睡眠，减少长时间低头看屏幕；做好保湿和防晒。",
    uvDamage: "上午 10 点至下午 4 点减少暴晒，阴天也坚持防晒。",
    sensitivity: "精简护肤，暂停高浓度酸类；新产品先做耳后斑贴测试。",
    darkCircles: "保证 7 小时睡眠，减少揉眼；睡前少喝水避免浮肿。",
    firmness: "规律作息，增加优质蛋白摄入；避免快速减重。",
    acne: "减少高糖、高油饮食；不要手挤痘痘，枕套毛巾勤换洗。",
    radiance: "保证饮水与睡眠，适度运动；避免长期熬夜。",
};

const INGREDIENTS: Record<string, string> = {
    waterOil: "含烟酰胺（调节油脂）的精华 + 透明质酸钠（补水）的保湿霜，早晚使用",
    skinTone: "含烟酰胺（提亮）或光甘草定（均匀肤色）的精华，每日早晚",
    spots: "含α-熊果苷（淡化色沉）或烟酰胺（提亮）的精华，每晚使用",
    wrinkles: "含羟丙基四氢吡喃三醇（玻色因，紧致）或乙酰基六肽-8（淡纹）的精华，每晚使用",
    uvDamage: "白天使用 SPF30+ 防晒，配合含生育酚（维生素E，抗氧化）的精华",
    sensitivity: "含泛醇（维生素B5，修护）或神经酰胺NP（屏障）的修护霜，早晚使用",
    darkCircles: "含烟酰胺（提亮）或生育酚（维生素E，抗氧化）的眼霜，每晚使用",
    firmness: "含羟丙基四氢吡喃三醇（玻色因，紧致）或棕榈酰三肽-5（弹性）的精华，每晚使用",
    acne: "含壬二酸（疏通毛孔）或乳酸（温和代谢）的精华，从每周 2 次开始建立耐受",
    radiance: "含抗坏血酸葡糖苷（AA2G，提亮）或烟酰胺（提亮）的精华，白天使用并配合防晒",
};

const SAFE_ACNE_INGREDIENTS = "含烟酰胺（调节油脂）的精华 + 泛醇（维生素B5，舒缓）的修护霜，早晚使用";

const MAX_ISSUES = 3;

function asStringArray(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    return [];
}

function hasAcidAllergy(answers: Record<string, unknown>): boolean {
    return asStringArray(answers.allergies).includes("acids");
}

function isPregnancyCautious(answers: Record<string, unknown>): boolean {
    const raw = answers.pregnancy ?? answers.pregnancyStatus;
    return raw === "yes" || raw === "unknown";
}

function ingredientsFor(key: string, answers: Record<string, unknown>): string {
    if (key === "acne" && (hasAcidAllergy(answers) || isPregnancyCautious(answers))) {
        return SAFE_ACNE_INGREDIENTS;
    }
    return INGREDIENTS[key] || "按每日方案使用温和清洁、保湿与防晒产品";
}

function indirectCauses(answers: Record<string, unknown>): string {
    const cues: string[] = [];
    if (answers.sleepQuality === "poor") cues.push("近期睡眠不足可能拖慢夜间修护");
    if (answers.stressLevel === "high") cues.push("压力偏高会影响激素与炎症反应");
    if (answers.sunExposure === "high") cues.push("日晒较多会加重色沉与光老化");
    if (answers.dietaryHabits === "highSugar" || answers.dietaryHabits === "highOil") {
        cues.push("高糖/高油饮食可能加重出油与痘痘");
    }
    if (answers.waterIntake === "low") cues.push("饮水偏少会影响角质层含水量");
    return cues.length > 0 ? cues.join("；") + "。" : "目前没有明显的生活习惯诱因。";
}

function toConsultantIssue(finding: ReportFinding, answers: Record<string, unknown>): ConsultantIssue {
    const key = finding.evidenceRefs.find((ref) => ref.type === "dimension")?.key || "";
    const label = DIMENSION_LABELS[key] || finding.title;
    const observation = finding.narrative.observation
        || `${label}本次 ${finding.score ?? "—"} 分，${finding.title}。`;
    return {
        title: finding.title,
        severity: finding.severity,
        observation,
        directCauses: DIRECT_CAUSES[key] || "与皮肤屏障、油脂分泌和日常护理习惯相关。",
        indirectCauses: indirectCauses(answers),
        skincarePlan: ingredientsFor(key, answers),
        lifestylePlan: LIFESTYLE[key] || "保持规律作息、温和清洁与日常防晒。",
        medicalBoundary: finding.severity === "mild"
            ? ""
            : "如持续加重、出现红肿刺痛、渗出或自行护理 2 周无改善，建议到皮肤科面诊。",
        relatedDimensions: [key].filter(Boolean) as ConsultantIssue["relatedDimensions"],
    };
}

export interface FallbackReportInput {
    faceAnalysis: FaceAnalysisResult | null;
    answers: Record<string, unknown>;
    diagnosis: DiagnosisResult;
}

export function buildFallbackConsultantReport({
    faceAnalysis,
    answers,
    diagnosis,
}: FallbackReportInput): ConsultantReport {
    const issues = diagnosis.findings.slice(0, MAX_ISSUES).map((finding) => toConsultantIssue(finding, answers));
    const strengths = Object.entries(faceAnalysis?.dimensions ?? {})
        .filter(([, dim]) => typeof dim?.score === "number" && dim.notVisible !== true && (dim.score as number) >= 80)
        .sort((a, b) => (b[1]!.score as number) - (a[1]!.score as number))
        .slice(0, 2)
        .map(([key, dim]) => `${DIMENSION_LABELS[key] || key} ${Math.round(dim!.score as number)} 分，状态保持得不错`);

    const overview = issues.length > 0
        ? `本次检测最需要关注的是${issues.map((issue) => issue.title).join("、")}。以下建议基于照片和问卷的可见信息生成，按优先级执行即可，4 周后复测对比变化。`
        : "本次检测未发现需要重点关注的问题，整体状态较稳定。继续保持温和清洁、基础保湿和日常防晒，4 周后复测即可。";

    return {
        overview,
        issues,
        strengths: strengths.length > 0 ? strengths : ["整体状态较稳定"],
        routineNote: "本次为规则版报告，建议先按每日方案执行基础护理，4 周后复测。",
        productReasons: [],
    };
}
