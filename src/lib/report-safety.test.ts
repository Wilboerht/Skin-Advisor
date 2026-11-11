import { describe, expect, it } from "vitest";
import { buildSafetyNotes } from "./report-safety";

describe("buildSafetyNotes", () => {
    it("过敏史与孕期排除项进入 excluded", () => {
        const notes = buildSafetyNotes({
            allergies: ["fragrance", "alcohol"],
            pregnancyStatus: "yes",
        });
        expect(notes.excluded).toContain("香精");
        expect(notes.excluded).toContain("酒精");
        expect(notes.excluded.some((item) => item.includes("精油类"))).toBe(true);
        expect(notes.conflicts.some((item) => item.includes("孕期"))).toBe(true);
    });

    it("活性成分从产品成分去重提取，并给出酸类叠加提示", () => {
        const notes = buildSafetyNotes({
            products: [
                { keyIngredients: ["壬二酸", "烟酰胺"] },
                { keyIngredients: ["烟酰胺", "神经酰胺NP"] },
            ],
        });
        expect(notes.actives).toEqual(["壬二酸", "烟酰胺", "神经酰胺NP"]);
        expect(notes.conflicts.some((item) => item.includes("酸类"))).toBe(true);
        expect(notes.sunProtection).toContain("SPF30+");
    });

    it("中度/重度问题的 medicalBoundary 汇总到就医边界", () => {
        const notes = buildSafetyNotes({
            issues: [
                { severity: "mild", medicalBoundary: "轻微问题不需要就医" },
                { severity: "moderate", medicalBoundary: "持续泛红超过两周建议面诊" },
                { severity: "severe", medicalBoundary: "出现渗出或疼痛请及时就医" },
            ],
        });
        expect(notes.whenToSeeDoctor).toHaveLength(2);
        expect(notes.whenToSeeDoctor).toContain("持续泛红超过两周建议面诊");
    });

    it("没有风险信号时给通用就医提示", () => {
        const notes = buildSafetyNotes({});
        expect(notes.whenToSeeDoctor).toHaveLength(1);
        expect(notes.whenToSeeDoctor[0]).toContain("皮肤科");
    });
});
