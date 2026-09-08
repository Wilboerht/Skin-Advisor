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

    const uvDamage = dims?.uvDamage?.score ?? 0;
    const value = dims
        ? uvDamage > 40
            ? "III 型"
            : uvDamage > 30
                ? "II 型"
                : "I 型"
        : "?";

    return {
        param: "光老化等级 (Glogau Scale)",
        value,
        ref: "I-III 型分级",
        status: dims ? "AI 估算" : "-",
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
    const acne = dims?.acne?.score ?? 0;

    const value = dims
        ? acne >= 75
            ? "轻微"
            : acne >= 55
                ? "中等"
                : "严重"
        : "?";
    const status = dims ? (acne >= 60 ? "少量" : "偏多") : "-";

    return {
        param: "痘痘 / 痤疮 (Acne Severity)",
        value,
        ref: "≥ 60 为正常",
        status,
    };
}

function computeSpots(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const spots = dims?.spots?.score ?? 0;

    const value = dims
        ? spots >= 75
            ? "少量"
            : spots >= 50
                ? "中等"
                : "明显"
        : "?";
    const status = dims ? (spots >= 60 ? "少量" : "偏多") : "-";

    return {
        param: "色斑 / 色素沉着 (Pigmentation)",
        value,
        ref: "≥ 60 为正常",
        status,
    };
}

function computeSensitivity(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const sensitivity = dims?.sensitivity?.score ?? 0;

    const value = dims
        ? sensitivity >= 70
            ? "正常"
            : sensitivity >= 45
                ? "轻度敏感"
                : "敏感"
        : "?";
    const status = dims ? (sensitivity >= 60 ? "正常" : "泛红") : "-";

    return {
        param: "泛红 / 敏感 (Redness/Sensitivity)",
        value,
        ref: "≥ 60 为正常",
        status,
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
