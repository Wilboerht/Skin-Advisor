import { describe, it, expect } from "vitest";
import {
    scanZoneAdviceViolations,
    enforceZoneAdviceIngredients,
    SAFE_ZONE_ADVICE_FALLBACK,
} from "./ingredient-guard";

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
