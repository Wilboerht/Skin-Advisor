import { describe, it, expect } from "vitest";
import { matchCharacterIP } from "./result-utils";

/**
 * 派系匹配规则（2026-09 文案改版后）：
 * - 敏敏派：sensitive 肤质（不限分数）
 * - 极简派：非敏感 + score<95 + 低预算 + 低频护肤（≥ 其它肤质派系）
 * - 奢华派：score ≥ 95
 * - 冻龄派：score 90-94
 * - 沙漠/油条/混合/守护：按肤质命中（干/油/混合/中性），不限分数
 * - 肤质无法识别：兜底混合派
 */
describe("matchCharacterIP（按肤质重构后）", () => {
  it("敏感肤质不限分数命中敏敏派", () => {
    expect(matchCharacterIP({ score: 60, skinType: "sensitive" }).key).toBe("sensitive");
    expect(matchCharacterIP({ score: 98, skinType: "sensitive" }).key).toBe("sensitive");
  });

  it("干性肤质不限分数命中沙漠派（旧逻辑低分归守护派）", () => {
    expect(matchCharacterIP({ score: 60, skinType: "dry" }).key).toBe("desert");
    expect(matchCharacterIP({ score: 85, skinType: "dry" }).key).toBe("desert");
  });

  it("油性/混合肤质不限分数命中对应派系", () => {
    expect(matchCharacterIP({ score: 60, skinType: "oily" }).key).toBe("oily");
    expect(matchCharacterIP({ score: 60, skinType: "combination" }).key).toBe("combination");
    expect(matchCharacterIP({ score: 70, skinType: "combination_dry" }).key).toBe("combination");
    expect(matchCharacterIP({ score: 70, skinType: "combination_oily" }).key).toBe("combination");
  });

  it("中性肤质命中守护派（底子稳定 · 预防维稳定位）", () => {
    expect(matchCharacterIP({ score: 85, skinType: "normal" }).key).toBe("guardian");
    expect(matchCharacterIP({ score: 60, skinType: "normal" }).key).toBe("guardian");
  });

  it("高分档优先于肤质：90-94 冻龄、≥95 奢华", () => {
    expect(matchCharacterIP({ score: 92, skinType: "dry" }).key).toBe("ageless");
    expect(matchCharacterIP({ score: 95, skinType: "normal" }).key).toBe("luxury");
    expect(matchCharacterIP({ score: 98, skinType: "oily" }).key).toBe("luxury");
  });

  it("极简派：非敏感 + 低预算 + 低频护肤，优先于肤质派系", () => {
    expect(
      matchCharacterIP({ score: 80, skinType: "normal", budget: "budget", skincareFrequency: "rarely" }).key
    ).toBe("minimalist");
    expect(
      matchCharacterIP({ score: 80, skinType: "dry", budget: "budget", skincareFrequency: "occasional" }).key
    ).toBe("minimalist");
    // 敏感肤质优先级最高，不受极简条件影响
    expect(
      matchCharacterIP({ score: 80, skinType: "sensitive", budget: "budget", skincareFrequency: "rarely" }).key
    ).toBe("sensitive");
  });

  it("肤质无法识别时兜底混合派（不再按分数分档）", () => {
    expect(matchCharacterIP({ score: 80, skinType: "" }).key).toBe("combination");
    expect(matchCharacterIP({ score: 50, skinType: "" }).key).toBe("combination");
    expect(matchCharacterIP({ score: 50, skinType: "未知类型" }).key).toBe("combination");
  });

  it("中文肤质描述归一化后命中对应派系", () => {
    expect(matchCharacterIP({ score: 60, skinType: "混干皮" }).key).toBe("combination");
    expect(matchCharacterIP({ score: 60, skinType: "敏感" }).key).toBe("sensitive");
    expect(matchCharacterIP({ score: 60, skinType: "油性" }).key).toBe("oily");
    expect(matchCharacterIP({ score: 60, skinType: "中性" }).key).toBe("guardian");
  });
});
