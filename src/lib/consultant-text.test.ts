import { describe, it, expect } from "vitest";
import { stripConsultantStepLabels, splitConsultantSentences } from "./consultant-text";

describe("stripConsultantStepLabels - 步骤标签复述剥离", () => {
    it("去掉开头的中文冒号标签", () => {
        expect(stripConsultantStepLabels("我看到的：全脸存在眼周动态细纹")).toBe("全脸存在眼周动态细纹");
        expect(stripConsultantStepLabels("直接诱因：紫外线反复照射会降解胶原")).toBe("紫外线反复照射会降解胶原");
        expect(stripConsultantStepLabels("间接诱因：你提到睡眠较差")).toBe("你提到睡眠较差");
        expect(stripConsultantStepLabels("护理方案：晨间使用含烟酰胺的精华")).toBe("晨间使用含烟酰胺的精华");
        expect(stripConsultantStepLabels("生活方案：把入睡时间提前")).toBe("把入睡时间提前");
        expect(stripConsultantStepLabels("就医边界：出现持续灼热建议面诊")).toBe("出现持续灼热建议面诊");
    });

    it("支持半角冒号、顿号、破折号等分隔符", () => {
        expect(stripConsultantStepLabels("直接诱因: 紫外线损伤")).toBe("紫外线损伤");
        expect(stripConsultantStepLabels("护理方案 · 晨间使用 AA2G 精华")).toBe("晨间使用 AA2G 精华");
        expect(stripConsultantStepLabels("就医边界——出现红肿需面诊")).toBe("出现红肿需面诊");
    });

    it("重复标签（模型复述两层）也能全部剥离", () => {
        expect(stripConsultantStepLabels("直接诱因：直接诱因：紫外线损伤")).toBe("紫外线损伤");
        expect(stripConsultantStepLabels("我看到的：我看到的：全脸泛红")).toBe("全脸泛红");
    });

    it("无分隔符的正常句子不误伤", () => {
        expect(stripConsultantStepLabels("生活调整很重要，先从作息开始")).toBe("生活调整很重要，先从作息开始");
        expect(stripConsultantStepLabels("护理方案里提到的成分需要坚持使用")).toBe("护理方案里提到的成分需要坚持使用");
    });

    it("只有标签没有正文时保持原样，不清空", () => {
        expect(stripConsultantStepLabels("就医边界：")).toBe("就医边界：");
        expect(stripConsultantStepLabels("我看到的")).toBe("我看到的");
    });
});

describe("splitConsultantSentences - 行动字段拆行", () => {
    it("按句号/分号拆分且保留标点", () => {
        const text = "晨间使用含烟酰胺的抗氧化精华，晚间使用含玻色因的抗老精华；早晚坚持防晒，抗老必须建立在严格防晒基础上。";
        const lines = splitConsultantSentences(text, 10);
        expect(lines).toHaveLength(2);
        expect(lines[0].endsWith("；")).toBe(true);
        expect(lines[1].endsWith("。")).toBe(true);
    });

    it("短文本保持整段", () => {
        expect(splitConsultantSentences("规律作息。")).toEqual(["规律作息。"]);
    });

    it("无句子边界的文本保持整段", () => {
        const text = "把入睡时间尽量提前到23:30前哪怕只早30分钟也能提升夜间生长激素分泌峰值助力胶原再生白天也要涂够量防晒";
        expect(splitConsultantSentences(text, 10)).toEqual([text]);
    });
});
