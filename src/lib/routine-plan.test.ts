import { describe, expect, it } from "vitest";
import { buildRoutinePlan } from "./routine-plan";

describe("buildRoutinePlan", () => {
    it("按派系 m4 早晚文案拆步骤并匹配产品", () => {
        const plan = buildRoutinePlan({
            persona: "sensitive",
            products: [
                { id: "cleanse", name: "云朵洁面", category: "洁面" },
                { id: "serum", name: "修护精华", category: "精华露" },
                { id: "cream", name: "白魔法面霜", category: "面霜" },
            ],
        });
        expect(plan).not.toBeNull();
        expect(plan!.morning.length).toBeGreaterThan(0);
        expect(plan!.night.length).toBeGreaterThan(0);
        expect(plan!.morning.some((step) => step.productName === "云朵洁面")).toBe(true);
        expect(plan!.morning.some((step) => step.productName === "白魔法面霜")).toBe(true);
        expect(plan!.note).toBeTruthy();
    });

    it("无派系时返回 null", () => {
        expect(buildRoutinePlan({ products: [] })).toBeNull();
    });
});
