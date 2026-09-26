import { describe, it, expect } from "vitest";
import { parseConsultantReport, sanitizeConsultantText } from "./advisor-utils";

function makeIssue(overrides: Record<string, unknown> = {}) {
    return {
        title: "两颊泛红",
        severity: "moderate",
        observation: "两颊可见轻度泛红。",
        directCauses: "屏障偏薄。",
        indirectCauses: "近期熬夜较多。",
        skincarePlan: "使用含神经酰胺NP的乳霜。",
        lifestylePlan: "规律作息。",
        medicalBoundary: "暂不需要就医。",
        relatedDimensions: ["sensitivity"],
        ...overrides,
    };
}

function makeRaw(issues: unknown[], extra: Record<string, unknown> = {}) {
    return JSON.stringify({ overview: "整体状态稳定。", issues, strengths: [], ...extra });
}

describe("parseConsultantReport - v2 报告解析容错", () => {
    it("severity 支持中文并归一小写，缺失推理链字段补默认值", () => {
        const report = parseConsultantReport(makeRaw([
            makeIssue({ severity: "中度", directCauses: "", indirectCauses: undefined, medicalBoundary: undefined }),
        ]));
        expect(report.issues).toHaveLength(1);
        expect(report.issues[0].severity).toBe("moderate");
        expect(report.issues[0].directCauses).toBe("详见上方观察。");
        expect(report.issues[0].indirectCauses).toBe("目前没有明显的生活习惯诱因。");
        expect(report.issues[0].medicalBoundary).toBe("暂不需要就医，坚持护理观察即可。");
    });

    it("缺 title/observation 的问题整条丢弃", () => {
        const report = parseConsultantReport(makeRaw([
            makeIssue(),
            makeIssue({ observation: undefined }),
            makeIssue({ title: undefined }),
        ]));
        expect(report.issues).toHaveLength(1);
    });

    it("超过 4 个问题时截断为 4 个（不因超出上限整报告失败）", () => {
        const report = parseConsultantReport(makeRaw(Array.from({ length: 6 }, (_, i) => makeIssue({ title: `问题${i}` }))));
        expect(report.issues).toHaveLength(4);
    });

    it("非法 JSON 抛出可捕获错误，供调用方走修复重试", () => {
        expect(() => parseConsultantReport("这不是 JSON")).toThrow();
    });
});

describe("sanitizeConsultantText - 程序字段名清洗", () => {
    it("替换 camelCase 字段名为中文标签，不误伤正常英文单词", () => {
        expect(sanitizeConsultantText("tZone 出油，waterOil 偏油")).toBe("T区 出油，水油平衡 偏油");
        expect(sanitizeConsultantText("acne 与 spots 是合法单词，不替换")).toBe("acne 与 spots 是合法单词，不替换");
    });
});
