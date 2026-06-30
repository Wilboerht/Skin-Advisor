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
            ref: "Age Dependent",
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
        ref: "Age Dependent",
        status: "",
    };
}

function computeHomogeneity(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.homogeneity) {
        return {
            param: "肤色均匀度 (Homogeneity)",
            value: `${lab.homogeneity.value}${lab.homogeneity.unit || "%"}`,
            ref: lab.homogeneity.range || "< 15% C.V.",
            status: lab.homogeneity.status,
        };
    }

    const skinTone = dims?.skinTone?.score ?? 0;
    const value = dims ? `${(8 + (100 - skinTone) * 0.15).toFixed(1)}% C.V.` : "?";
    const status = dims ? (skinTone > 80 ? "均匀" : "不均") : "-";

    return {
        param: "肤色均匀度 (Homogeneity)",
        value,
        ref: "< 15% C.V.",
        status,
    };
}

function computePeriorbitalContrast(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const darkCircles = dims?.darkCircles?.score;

    const value = darkCircles !== undefined
        ? `${(1.2 + (100 - darkCircles) * 0.05).toFixed(1)} Delta E`
        : "?";
    const status = darkCircles !== undefined ? (darkCircles > 80 ? "正常" : "明显") : "-";

    return {
        param: "眼周色素对比度 (Periorbital Contrast)",
        value,
        ref: "< 3.0 Delta E",
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
            ref: lab.wrinkleGrade.range || "Grade 1",
            status: lab.wrinkleGrade.status,
        };
    }

    const wrinkles = dims?.wrinkles?.score ?? 0;
    const value = dims
        ? wrinkles > 80
            ? "Grade 1 (None)"
            : wrinkles > 60
                ? "Grade 2 (Fine)"
                : "Grade 3 (Deep)"
        : "?";
    const status = dims ? (wrinkles > 60 ? "正常" : "明显") : "-";

    return {
        param: "皱纹严重度分级 (Wrinkle Severity)",
        value,
        ref: "Grade 1",
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
            ],
        },
    ];
}
