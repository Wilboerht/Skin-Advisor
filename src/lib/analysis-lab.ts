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

// ---------- Biophysical Profile ----------

function computeSkinPh(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.skinPh) {
        return {
            param: "皮肤 pH 值 (Est. pH)",
            value: String(lab.skinPh.value),
            ref: lab.skinPh.range || "4.5 - 5.5",
            status: lab.skinPh.status,
        };
    }

    const waterOil = dims?.waterOil?.score ?? 0;
    const value = dims
        ? (5.5 + (waterOil < 60 ? 0.4 : -0.2) + ((waterOil % 100) / 1000) * 3).toFixed(1)
        : "?";
    const status = dims ? (waterOil < 60 ? "偏碱" : "正常") : "-";

    return {
        param: "皮肤 pH 值 (Est. pH)",
        value,
        ref: "4.5 - 5.5",
        status,
    };
}

function computeTewl(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.tewl) {
        return {
            param: "经表皮失水率 (TEWL)",
            value: `${lab.tewl.value} ${lab.tewl.unit || "g/m²/h"}`,
            ref: lab.tewl.range || "< 10.0 g/m²/h",
            status: lab.tewl.status,
        };
    }

    const sensitivity = dims?.sensitivity?.score ?? 0;
    const value = dims ? `${(20 - (sensitivity / 100) * 12).toFixed(1)} g/m²/h` : "?";
    const status = dims ? (sensitivity > 80 ? "正常" : "偏高") : "-";

    return {
        param: "经表皮失水率 (TEWL)",
        value,
        ref: "< 10.0 g/m²/h",
        status,
    };
}

function computeHydration(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const hydration = faceAnalysis?.hydration;

    if (!hydration?.level) {
        return {
            param: "角质层含水量 (Hydration)",
            value: "?",
            ref: "> 35.0 AU",
            status: "-",
        };
    }

    const value = hydration.percent
        ? `${hydration.percent} AU`
        : dims
            ? `${(20 + (dims.waterOil.score / 100) * 40).toFixed(1)} AU`
            : "?";
    const status = hydration.level === "low" ? "偏低" : "正常";

    return {
        param: "角质层含水量 (Hydration)",
        value,
        ref: "> 35.0 AU",
        status,
    };
}

function computeElasticity(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.elasticity) {
        return {
            param: "真皮层弹性 (Elasticity R2)",
            value: `${lab.elasticity.value} ${lab.elasticity.unit || ""}`.trim(),
            ref: lab.elasticity.range || "> 0.70",
            status: lab.elasticity.status,
        };
    }

    const firmness = dims?.firmness?.score ?? 0;
    const value = dims ? `${(0.4 + (firmness / 100) * 0.5).toFixed(2)}` : "?";
    const status = dims ? (firmness > 60 ? "紧致" : "松弛") : "-";

    return {
        param: "真皮层弹性 (Elasticity R2)",
        value,
        ref: "> 0.70",
        status,
    };
}

// ---------- Chromophore Map ----------

function computeMelanin(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.melanin) {
        return {
            param: "黑色素指数 (Melanin Index)",
            value: `${lab.melanin.value} ${lab.melanin.unit || "MI"}`,
            ref: lab.melanin.range || "< 150 MI",
            status: lab.melanin.status,
        };
    }

    const spots = dims?.spots?.score ?? 0;
    const value = dims ? `${Math.round(220 - spots * 1.5)} MI` : "?";
    const status = dims ? (spots < 60 ? "偏高" : "正常") : "-";

    return {
        param: "黑色素指数 (Melanin Index)",
        value,
        ref: "< 150 MI",
        status,
    };
}

function computeErythema(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.erythema) {
        return {
            param: "红斑指数 (Erythema Index)",
            value: `${lab.erythema.value} ${lab.erythema.unit || "EI"}`,
            ref: lab.erythema.range || "< 200 EI",
            status: lab.erythema.status,
        };
    }

    const sensitivity = dims?.sensitivity?.score ?? 0;
    const value = dims ? `${Math.round(350 - sensitivity * 2.2)} EI` : "?";
    const status = dims ? (sensitivity < 60 ? "偏高" : "正常") : "-";

    return {
        param: "红斑指数 (Erythema Index)",
        value,
        ref: "< 200 EI",
        status,
    };
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
        status: "-",
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

// ---------- Surface & Microbiome ----------

function computePorphyrins(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.porphyrins) {
        return {
            param: "卟啉计数 (Porphyrins)",
            value: String(lab.porphyrins.value),
            ref: "Low Risk",
            status: lab.porphyrins.status,
        };
    }

    const acne = dims?.acne?.score ?? 0;
    const value = dims ? `${Math.round(40 - acne * 0.35)}` : "?";
    const status = dims
        ? acne < 60
            ? "偏多"
            : acne < 80
                ? "中等"
                : "少"
        : "-";

    return {
        param: "卟啉计数 (Porphyrins)",
        value,
        ref: "Low Risk",
        status,
    };
}

function computeSebum(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.sebum) {
        return {
            param: "皮脂分泌率 (Sebum Rate)",
            value: String(lab.sebum.value),
            ref: "Balanced",
            status: lab.sebum.status,
        };
    }

    const waterOil = dims?.waterOil?.score ?? 0;
    const value = dims ? (waterOil < 60 ? "High" : "Normal") : "?";
    const status = dims ? (waterOil < 60 ? "旺盛" : "正常") : "-";

    return {
        param: "皮脂分泌率 (Sebum Rate)",
        value,
        ref: "Balanced",
        status,
    };
}

function computeRoughness(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.roughness) {
        return {
            param: "皮肤平滑度 (Roughness Ra)",
            value: `${lab.roughness.value} ${lab.roughness.unit || "µm"}`,
            ref: lab.roughness.range || "< 10.0 µm",
            status: lab.roughness.status,
        };
    }

    const firmness = dims?.firmness?.score ?? 0;
    const value = dims ? `${(5 + (100 - firmness) * 0.15).toFixed(1)} µm` : "?";
    const status = dims ? (firmness < 70 ? "粗糙" : "细腻") : "-";

    return {
        param: "皮肤平滑度 (Roughness Ra)",
        value,
        ref: "< 10.0 µm",
        status,
    };
}

function computeGlossiness(faceAnalysis: FaceAnalysisResult | null): LabMetric {
    const dims = getDimensions(faceAnalysis);
    const lab = getLabAnalysis(faceAnalysis);

    if (lab?.glossiness) {
        return {
            param: "光泽度指数 (Glossiness GU)",
            value: `${lab.glossiness.value} ${lab.glossiness.unit || "GU"}`,
            ref: lab.glossiness.range || "> 6.0 GU",
            status: lab.glossiness.status,
        };
    }

    const radiance = dims?.radiance?.score ?? 0;
    const value = dims ? `${(radiance * 0.1).toFixed(1)} GU` : "?";
    const status = dims ? (radiance > 60 ? "透亮" : "暗沉") : "-";

    return {
        param: "光泽度指数 (Glossiness GU)",
        value,
        ref: "> 6.0 GU",
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

// ---------- Public API ----------

export function computeLabAnalysis(faceAnalysis: FaceAnalysisResult | null): LabMetricGroup[] {
    return [
        {
            title: "I. 生物物理特性",
            titleEn: "Biophysical Profile",
            metrics: [
                computeSkinPh(faceAnalysis),
                computeTewl(faceAnalysis),
                computeHydration(faceAnalysis),
                computeElasticity(faceAnalysis),
            ],
        },
        {
            title: "II. 色基分布分析",
            titleEn: "Chromophore Map",
            metrics: [
                computeMelanin(faceAnalysis),
                computeErythema(faceAnalysis),
                computeGlogau(faceAnalysis),
                computeHomogeneity(faceAnalysis),
                computePeriorbitalContrast(faceAnalysis),
            ],
        },
        {
            title: "III. 表面与微生态",
            titleEn: "Surface & Microbiome",
            metrics: [
                computePorphyrins(faceAnalysis),
                computeSebum(faceAnalysis),
                computeRoughness(faceAnalysis),
                computeGlossiness(faceAnalysis),
                computeWrinkleGrade(faceAnalysis),
            ],
        },
    ];
}
