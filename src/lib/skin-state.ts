/**
 * 测肤拍摄时肌肤状态（扫脸引导弹窗单选）
 * 影响视觉分析的条件化判断（带妆掩盖纹理/泛红/色斑，洗后短暂泛红等）与结果页提示
 */

export const SKIN_STATE_OPTIONS = [
    { value: "bare", label: "纯素颜" },
    { value: "sunscreen", label: "只涂了防晒" },
    { value: "washed", label: "刚洗完脸（未护肤）" },
    { value: "light_makeup", label: "带淡妆" },
    { value: "heavy_makeup", label: "带浓妆" },
] as const;

export type SkinStateValue = (typeof SKIN_STATE_OPTIONS)[number]["value"];

export const SKIN_STATE_LABELS: Record<string, string> = Object.fromEntries(
    SKIN_STATE_OPTIONS.map((o) => [o.value, o.label])
);

export const DEFAULT_SKIN_STATE: SkinStateValue = "bare";

/** 带妆状态：结果页对色斑/泛红/肤色类结论加"仅供参考"提示 */
export function isMakeupState(value: string | null | undefined): boolean {
    return value === "light_makeup" || value === "heavy_makeup";
}

/** 视觉 prompt 条件化说明（按状态给出判定注意事项） */
export function buildSkinStateVisionNote(value: string | null | undefined): string {
    const label = value ? SKIN_STATE_LABELS[value] : undefined;
    if (!label) return "";
    let note = `# 用户拍摄时肌肤状态：${label}\n# 分析时必须考虑拍摄状态对判断的影响：`;
    if (value === "light_makeup" || value === "heavy_makeup") {
        note += "底妆会掩盖纹理、毛孔、泛红与色斑，sensitivity/spots/skinTone/acne 维度的判定需降低置信度，details 中可注明\"底妆可能影响该判断\"；";
    }
    if (value === "washed") {
        note += "刚洗完脸可能出现暂时性泛红与紧绷，sensitivity 判定需谨慎；";
    }
    if (value === "sunscreen") {
        note += "防晒霜会影响光泽度与油光判断，radiance/waterOil 判定需谨慎；";
    }
    return note;
}

/** 文本 prompt 条件化说明（报告撰写注意事项） */
export function buildSkinStateTextNote(value: string | null | undefined): string {
    const label = value ? SKIN_STATE_LABELS[value] : undefined;
    if (!label) return "";
    if (value === "light_makeup" || value === "heavy_makeup") {
        return `拍摄时肌肤状态：${label}。报告中涉及色斑、泛红、肤色均匀度的结论需降低语气强度，并在报告末尾自然提醒"本次为带妆拍摄，相关结论仅供参考"。`;
    }
    if (value === "washed") {
        return `拍摄时肌肤状态：${label}。对敏感性判定需谨慎，可能为暂时性泛红。`;
    }
    if (value === "sunscreen") {
        return `拍摄时肌肤状态：${label}。对光泽度与油光相关结论需谨慎。`;
    }
    return "";
}
