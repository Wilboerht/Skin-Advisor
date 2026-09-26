import { describe, it, expect } from "vitest";
import {
    scanZoneAdviceViolations,
    enforceZoneAdviceIngredients,
    enforceConsultantReportIngredients,
    SAFE_ZONE_ADVICE_FALLBACK,
    SAFE_SKINCARE_PLAN_FALLBACK,
    SAFE_PRODUCT_REASON_FALLBACK,
} from "./ingredient-guard";
import type { ConsultantReport } from "./advisor-utils";

describe("scanZoneAdviceViolations - 禁用成分扫描", () => {
    it("命中体系外成分（水杨酸/视黄醇/咖啡因/白泥）", () => {
        const zoneAnalysis = {
            tZone: { advice: "每日使用含水杨酸的洁面乳清洁，配合白泥面膜" },
            jawline: { advice: "每日使用含视黄醇或胜肽的精华液" },
            eyeArea: { advice: "早晚使用含咖啡因的眼霜" },
        };
        const violations = scanZoneAdviceViolations(zoneAnalysis);
        const keywords = violations.map((v) => v.keyword);
        expect(keywords).toContain("水杨酸");
        expect(keywords).toContain("白泥");
        expect(keywords).toContain("视黄醇");
        expect(keywords).toContain("咖啡因");
        expect(violations.map((v) => v.zone)).toEqual(
            expect.arrayContaining(["tZone", "jawline", "eyeArea"])
        );
    });

    it("白名单内成分不命中", () => {
        const zoneAnalysis = {
            tZone: { advice: "每日使用含壬二酸（疏通毛孔）的洁面，配合含烟酰胺的爽肤水" },
            leftCheek: { advice: "使用含神经酰胺NP的乳霜加强保湿封层" },
        };
        expect(scanZoneAdviceViolations(zoneAnalysis)).toEqual([]);
    });

    it("否定语境豁免：提醒避开的表述不算违规", () => {
        const zoneAnalysis = {
            forehead: { advice: "避免含酒精、香精的产品，选择温和配方" },
            tZone: { advice: "日常护理即可，无需使用含水杨酸的强力清洁" },
        };
        expect(scanZoneAdviceViolations(zoneAnalysis)).toEqual([]);
    });

    it("非法输入安全返回空数组", () => {
        expect(scanZoneAdviceViolations(null)).toEqual([]);
        expect(scanZoneAdviceViolations(undefined)).toEqual([]);
        expect(scanZoneAdviceViolations({ tZone: { advice: 123 } })).toEqual([]);
        expect(scanZoneAdviceViolations({ tZone: null })).toEqual([]);
    });
});

describe("enforceZoneAdviceIngredients - 违规降级", () => {
    it("违规区域的 advice 被替换为安全文案，其余区域不动", () => {
        const zoneAnalysis = {
            tZone: { condition: "偏油", advice: "每日使用含水杨酸的洁面乳" },
            leftCheek: { condition: "良好", advice: "使用含神经酰胺NP的乳霜" },
        };
        const violations = enforceZoneAdviceIngredients(zoneAnalysis);

        expect(violations).toHaveLength(1);
        expect(violations[0].zone).toBe("tZone");
        expect(violations[0].keyword).toBe("水杨酸");
        expect(zoneAnalysis.tZone.advice).toBe(SAFE_ZONE_ADVICE_FALLBACK);
        expect(zoneAnalysis.leftCheek.advice).toBe("使用含神经酰胺NP的乳霜");
        // 降级文案本身不能再含禁用成分
        expect(scanZoneAdviceViolations(zoneAnalysis)).toEqual([]);
    });

    it("未命中时不修改任何数据", () => {
        const zoneAnalysis = {
            tZone: { advice: "使用含壬二酸的洁面" },
        };
        const violations = enforceZoneAdviceIngredients(zoneAnalysis);
        expect(violations).toEqual([]);
        expect(zoneAnalysis.tZone.advice).toBe("使用含壬二酸的洁面");
    });
});

function makeReport(overrides: Partial<ConsultantReport> = {}): ConsultantReport {
    return {
        overview: "整体状态稳定，屏障功能良好。",
        issues: [
            {
                title: "T区出油",
                severity: "moderate",
                observation: "T区油光偏明显，毛孔可见。",
                directCauses: "皮脂腺活跃。",
                indirectCauses: "近期熬夜较多。",
                skincarePlan: "每日使用含壬二酸的洁面。",
                lifestylePlan: "规律作息。",
                medicalBoundary: "暂不需要就医。",
                relatedDimensions: ["waterOil"],
            },
        ],
        strengths: ["两颊屏障状态稳定。"],
        routineNote: "保持现有节奏。",
        productReasons: [{ id: "p1", reason: "含烟酰胺的精华更贴合你的需求。" }],
        ...overrides,
    };
}

describe("enforceConsultantReportIngredients - v2 报告禁用成分硬校验", () => {
    it("skincarePlan 命中禁用成分时整体降级为安全文案", () => {
        const report = makeReport();
        report.issues[0].skincarePlan = "早晚使用含水杨酸的爽肤水疏通毛孔。";
        const violations = enforceConsultantReportIngredients(report);

        expect(violations).toHaveLength(1);
        expect(violations[0].field).toBe("issues[0].skincarePlan");
        expect(violations[0].type).toBe("forbidden");
        expect(report.issues[0].skincarePlan).toBe(SAFE_SKINCARE_PLAN_FALLBACK);
    });

    it("叙述字段命中时用泛化词替换，保留句子语义", () => {
        const report = makeReport();
        report.issues[0].observation = "观察到使用视黄醇后出现轻微脱皮。";
        report.overview = "近期使用了高浓度果酸，皮肤略有泛红。";
        const violations = enforceConsultantReportIngredients(report);

        expect(violations.map((v) => v.keyword)).toEqual(expect.arrayContaining(["视黄醇", "果酸"]));
        expect(report.issues[0].observation).toBe("观察到使用刺激性成分后出现轻微脱皮。");
        expect(report.overview).toBe("近期使用了高浓度刺激性成分，皮肤略有泛红。");
    });

    it("否定语境豁免：提醒避开的表述不处理", () => {
        const report = makeReport();
        report.issues[0].lifestylePlan = "避免使用含酒精的产品，减少刺激。";
        const violations = enforceConsultantReportIngredients(report);

        expect(violations).toEqual([]);
        expect(report.issues[0].lifestylePlan).toBe("避免使用含酒精的产品，减少刺激。");
    });

    it("孕期模式额外扫描精油/香精，命中护理方案降级", () => {
        const report = makeReport();
        report.issues[0].skincarePlan = "夜间使用含迷迭香叶油的护理油。";

        // 非孕期不拦截
        const noPregnancy = enforceConsultantReportIngredients(report);
        expect(noPregnancy).toEqual([]);
        expect(report.issues[0].skincarePlan).toBe("夜间使用含迷迭香叶油的护理油。");

        // 孕期拦截并降级
        const pregnancy = enforceConsultantReportIngredients(report, { pregnancy: true });
        expect(pregnancy).toHaveLength(1);
        expect(pregnancy[0].type).toBe("pregnancy");
        expect(report.issues[0].skincarePlan).toBe(SAFE_SKINCARE_PLAN_FALLBACK);
    });

    it("productReasons 命中时降级为安全推荐理由", () => {
        const report = makeReport();
        report.productReasons = [{ id: "p1", reason: "这款含咖啡因的眼霜能改善黑眼圈。" }];
        const violations = enforceConsultantReportIngredients(report);

        expect(violations[0].field).toBe("productReasons[0].reason");
        expect(report.productReasons?.[0].reason).toBe(SAFE_PRODUCT_REASON_FALLBACK);
    });

    it("合规报告不被修改", () => {
        const report = makeReport();
        const violations = enforceConsultantReportIngredients(report, { pregnancy: true });
        expect(violations).toEqual([]);
    });
});
