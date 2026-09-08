import type { FaceAnalysisResult, LabAnalysisResult } from "./advisor-utils";

export interface LabMetric {
    param: string;
    value: string;
    ref: string;
    status: string;
}

export interface LabMetricGroup {
    title: string;
    titleEn: string;
    metrics: LabMetric[];
}

function getDimensions(faceAnalysis: FaceAnalysisResult | null) {
    return faceAnalysis?.dimensions ?? null;
}

function getLabAnalysis(faceAnalysis: FaceAnalysisResult | null): LabAnalysisResult | undefined {
    return faceAnalysis?.labAnalysis;
}

function computeGlogau(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.glogau) {
        return {
            param: "光老化等级 (Glogau Scale)",
            value: String(lab.glogau.value),
            ref: "I-III 型分级",
            status: lab.glogau.status,
        };
    }

    // uvDamage 分数越高损伤越少；Glogau I 型最轻、III 型最重
    // 阈值沿用 problem-solutions.ts 惯例：>=70 良好 / 40-69 中度 / <40 重度
    const uvDamage = dims?.uvDamage?.score;
    const value =
        uvDamage === undefined
            ? "?"
            : uvDamage >= 70
                ? "I 型"
                : uvDamage >= 40
                    ? "II 型"
                    : "III 型";

    return {
        param: "光老化等级 (Glogau Scale)",
        value,
        ref: "I-III 型分级",
        status: uvDamage === undefined ? "-" : "AI 估算",
    };
}

function computeHomogeneity(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    const status = lab?.homogeneity?.status || (dims ? (dims.skinTone?.score ?? 0) > 80 ? "均匀" : "不均" : "-");

    return {
        param: "肤色均匀度 (Homogeneity)",
        value: status,
        ref: "AI 视觉评估",
        status,
    };
}

function computePeriorbitalContrast(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const darkCircles = dims?.darkCircles?.score;

    const status = darkCircles !== undefined ? (darkCircles > 80 ? "正常" : "明显") : "-";

    return {
        param: "眼周色素沉着 (Periorbital Pigmentation)",
        value: status,
        ref: "AI 视觉评估",
        status,
    };
}

function computeWrinkleGrade(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.wrinkleGrade) {
        return {
            param: "皱纹严重度分级 (Wrinkle Severity)",
            value: String(lab.wrinkleGrade.value),
            ref: "1-3 级分级",
            status: lab.wrinkleGrade.status,
        };
    }

    const wrinkles = dims?.wrinkles?.score ?? 0;
    const value = dims
        ? wrinkles > 80
            ? "1 级（基本无皱纹）"
            : wrinkles > 60
                ? "2 级（可见细纹）"
                : "3 级（明显皱纹）"
        : "?";
    const status = dims ? (wrinkles > 60 ? "正常" : "明显") : "-";

    return {
        param: "皱纹严重度分级 (Wrinkle Severity)",
        value,
        ref: "1-3 级分级",
        status,
    };
}

function computeAcne(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const acne = dims?.acne?.score;

    // value 与 status 共用同一套阈值分段，保证同一分数下语义一致
    const band =
        acne === undefined
            ? null
            : acne >= 75
                ? { value: "轻微", status: "轻微" }
                : acne >= 60
                    ? { value: "少量", status: "少量" }
                    : acne >= 40
                        ? { value: "中等", status: "中等" }
                        : { value: "严重", status: "严重" };

    return {
        param: "痘痘 / 痤疮 (Acne Severity)",
        value: band?.value ?? "?",
        ref: "≥ 60 为正常",
        status: band?.status ?? "-",
    };
}

function computeSpots(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const spots = dims?.spots?.score;

    const band =
        spots === undefined
            ? null
            : spots >= 75
                ? { value: "少量", status: "少量" }
                : spots >= 60
                    ? { value: "中等", status: "中等" }
                    : { value: "明显", status: "明显" };

    return {
        param: "色斑 / 色素沉着 (Pigmentation)",
        value: band?.value ?? "?",
        ref: "≥ 60 为正常",
        status: band?.status ?? "-",
    };
}

function computeSensitivity(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const sensitivity = dims?.sensitivity?.score;

    const band =
        sensitivity === undefined
            ? null
            : sensitivity >= 60
                ? { value: "正常", status: "正常" }
                : sensitivity >= 40
                    ? { value: "轻度敏感", status: "轻度敏感" }
                    : { value: "敏感", status: "敏感" };

    return {
        param: "泛红 / 敏感 (Redness/Sensitivity)",
        value: band?.value ?? "?",
        ref: "≥ 60 为正常",
        status: band?.status ?? "-",
    };
}

function computeOiliness(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const waterOil = dims?.waterOil?.score ?? 0;

    const value = dims
        ? waterOil >= 60
            ? "正常"
            : "失衡"
        : "?";
    const status = dims ? (waterOil >= 60 ? "正常" : "失衡") : "-";

    return {
        param: "油光状态 (Oiliness)",
        value,
        ref: "≥ 60 为正常",
        status,
    };
}

function computeRadiance(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const radiance = dims?.radiance?.score ?? 0;

    const value = dims
        ? radiance >= 60
            ? "透亮"
            : "暗沉"
        : "?";
    const status = dims ? (radiance >= 60 ? "透亮" : "暗沉") : "-";

    return {
        param: "肤色亮度 / 暗沉 (Radiance)",
        value,
        ref: "≥ 60 为透亮",
        status,
    };
}

function computeFirmness(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const firmness = dims?.firmness?.score ?? 0;

    const value = dims
        ? firmness >= 60
            ? "紧致"
            : "松弛"
        : "?";
    const status = dims ? (firmness >= 60 ? "紧致" : "松弛") : "-";

    return {
        param: "皮肤紧致度 (Firmness)",
        value,
        ref: "≥ 60 为紧致",
        status,
    };
}

export function computeLabAnalysis(faceAnalysis: FaceAnalysisResult | null): LabMetricGroup[] {
    return [
        {
            title: "可见特征分析",
            titleEn: "Visual Features",
            metrics: [
                computeGlogau(faceAnalysis),
                computeHomogeneity(faceAnalysis),
                computePeriorbitalContrast(faceAnalysis),
                computeWrinkleGrade(faceAnalysis),
                computeAcne(faceAnalysis),
                computeSpots(faceAnalysis),
                computeSensitivity(faceAnalysis),
                computeOiliness(faceAnalysis),
                computeRadiance(faceAnalysis),
                computeFirmness(faceAnalysis),
            ],
        },
    ];
}
