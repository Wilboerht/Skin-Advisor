/**
 * 顾问报告展示文案的纯文本处理（客户端安全：不依赖 zod / 服务端模块）
 *
 * 1. stripConsultantStepLabels：去掉 AI 在字段开头复述的步骤标签
 *    （"我看到的：""直接诱因：""护理方案："…），这些标签由卡片 UI 渲染，
 *    数据里再带一遍会变成"我看到的 / 我看到的：…"的重复噪音。
 * 2. splitConsultantSentences：把较长的行动类段落按句子边界拆行，提升可扫描性。
 */

/** 步骤标签（与卡片 UI 的 StepLabel / 分组标题一一对应） */
const STEP_LABELS = [
    "我看到的",
    "直接诱因",
    "间接诱因",
    "护理方案",
    "生活方案",
    "生活调整",
    "就医边界",
    "就医提示",
] as const;

/** 标签与正文之间的分隔符（必须有其中之一，避免误伤"生活调整很重要"这类正常句子） */
const LABEL_SEPARATOR = /^[\s:：·、\-—。]+/;

/**
 * 去掉字段开头的步骤标签（可重复出现，如"直接诱因：直接诱因：…"）。
 * 仅处理开头；标签后必须跟分隔符（冒号/顿号/破折号等）才算复述。
 */
export function stripConsultantStepLabels(text: string): string {
    let out = text.trimStart();
    let changed = true;
    while (changed) {
        changed = false;
        for (const label of STEP_LABELS) {
            if (!out.startsWith(label)) continue;
            const restRaw = out.slice(label.length);
            const sep = restRaw.match(LABEL_SEPARATOR);
            if (!sep) continue;
            const rest = restRaw.slice(sep[0].length).trimStart();
            // 标签后必须还有正文，避免整段只剩标签时被清空
            if (rest.length > 0) {
                out = rest;
                changed = true;
                break;
            }
        }
    }
    return out;
}

/**
 * 按中文句子边界（。；）拆行；短文本或拆不出 ≥2 段时保持整段返回。
 * 只用于"护理方案/生活调整"这类行动清单式字段，观察/归因类叙述不拆。
 */
export function splitConsultantSentences(text: string, minLength = 48): string[] {
    const trimmed = text.trim();
    if (trimmed.length < minLength) return [trimmed];
    const parts = trimmed
        .split(/(?<=[；。])/)
        .map((part) => part.trim())
        .filter(Boolean);
    return parts.length >= 2 ? parts : [trimmed];
}
