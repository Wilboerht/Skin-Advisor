/**
 * 产品推荐理由：运营配置未命中时的算法模板 + 短标签。
 */

import type { EnvContext } from "@/lib/weather-context";

/**
 * Generate intelligent recommendation reason (Enhanced)
 * 个性化推荐理由：结合产品信息、用户肤质、派系身份和季节环境
 */
export function generateSmartReason(
    matchedBenefits: string[],
    concerns: string[],
    skinType: string,
    index: number = 0,
    productName?: string,
    productCategory?: string,
    persona?: string,
    season?: string,
    envContext?: EnvContext
): string {
    const personaFlavors: Record<string, string> = {
        sensitive: "温柔守护",
        minimalist: "精简高效",
        luxury: "奢华甄选",
        ageless: "时光逆转",
        desert: "深层润泽",
        oily: "清爽平衡",
        combination: "分区调理",
        guardian: "坚实守护",
    };

    if (matchedBenefits.length > 0) {
        const benefitText = matchedBenefits.slice(0, 2).join("、");
        const catText = productCategory || "";
        const personaHint = persona ? (personaFlavors[persona] || "") : "";

        const templates = [
            `${benefitText}${catText ? ` · ${catText}` : ""}，${personaHint || "精准匹配"}`,
            `主打${benefitText}，${catText ? `${catText}级` : ""}呵护你的${getSkinTypeLabelShort(skinType)}`,
            `富含${benefitText}成分，${personaHint ? `${personaHint}之选` : "改善肌肤状态"}`,
            `针对${getConcernLabelShort(concerns[index]) || "肌肤需求"}，${benefitText}${catText ? ` · ${catText}` : ""}`,
            `${benefitText}配方${catText ? `，${catText}品类优选` : "，科学护肤"}`,
            `专研${benefitText}，${season ? `适合${season}使用` : "回应肌肤诉求"}`,
            `${personaHint ? `${personaHint}·` : ""}${benefitText}${catText ? ` ${catText}` : ""}`,
            `${benefitText}协同呵护，${catText || "精准配方"}${season ? ` · ${season}推荐` : ""}`,
        ];
        return templates[index % templates.length];
    }

    const concernReasons: Record<string, string[]> = {
        anti_aging: ["淡化细纹，紧致肌肤", "抗氧化修护，延缓老化"],
        aging: ["延衰抗老，紧致提升", "深层修护，改善肌龄"],
        fine_lines: ["淡化表情纹与干纹", "平滑肌肤纹理"],
        wrinkles: ["减少皱纹深度，紧致轮廓", "抗皱提拉，重塑弹力"],
        dullness: ["提亮肤色，焕发光彩", "改善暗沉，恢复通透感"],
        dull: ["焕亮肤色，改善暗黄", "击退暗沉，光泽透亮"],
        pigmentation: ["匀净肤色，改善暗沉", "抑制黑色素，均匀提亮"],
        spots: ["淡化痘印，均匀提亮", "改善色素沉着，匀净肤色"],
        hydration: ["深层补水，持久保湿", "修护皮脂膜，锁水屏障"],
        dryness: ["密集补水，改善干燥脱皮", "滋润修护，缓解紧绷感"],
        sensitivity: ["舒缓褪红，温和修护", "增强屏障，降低敏感度"],
        acne: ["控油祛痘，净化毛孔", "平衡微生态，预防闭口"],
        oil_control: ["清爽控油，平衡水油", "调节皮脂，维持清爽"],
        dark_circles: ["修护眼周，淡化黑眼圈", "改善微循环，提亮眼周"],
        roughness: ["改善粗糙肤质，细致平滑", "温和焕肤，细腻毛孔"],
        waterOil: ["平衡水油，分区调理", "T区控油U区保湿"],
    };

    if (concerns.length > 0) {
        const concern = concerns[index % concerns.length];
        const reasons = concernReasons[concern];
        if (reasons) {
            const reason = reasons[index % reasons.length];
            const catHint = productCategory ? ` · ${productCategory}` : "";
            const seasonHint = season ? ` (${season}适用)` : "";
            return `${reason}${catHint}${seasonHint}`;
        }
    }

    const skinReasons: Record<string, string> = {
        dry: "滋润保湿，改善干燥紧绷",
        oily: "清爽控油，平衡水油分泌",
        combination: "分区护理，平衡T区与U区",
        combination_dry: "针对混干肤质，T区清爽U区滋润",
        combination_oily: "针对混油肤质，平衡多余油脂",
        sensitive: "温和低敏配方，呵护脆弱肌肤",
        normal: "维稳保养，维持水油平衡",
    };

    if (skinType && skinReasons[skinType]) {
        const skReason = skinReasons[skinType];
        const envHint = envContext ? `，${envContext.description}` : "";
        return `${skReason}${envHint}`;
    }

    return "适合日常护肤使用，维持肌肤健康状态";
}

/** 获取肤质短标签（用于推荐理由） */
export function getSkinTypeLabelShort(skinType: string): string {
    const labels: Record<string, string> = {
        dry: "干性肌", oily: "油性肌", combination: "混合肌",
        combination_dry: "混干肌", combination_oily: "混油肌",
        sensitive: "敏感肌", normal: "中性肌",
    };
    return labels[skinType] || "肌肤";
}

/** 获取关注点短标签 */
export function getConcernLabelShort(concern?: string): string {
    if (!concern) return "";
    const labels: Record<string, string> = {
        anti_aging: "抗老需求", aging: "抗老需求", fine_lines: "细纹困扰",
        wrinkles: "皱纹困扰", dullness: "暗沉问题", dull: "暗沉问题",
        pigmentation: "色斑困扰", spots: "色斑困扰", hydration: "补水需求",
        dryness: "干燥问题", sensitivity: "敏感困扰", acne: "痘痘困扰",
        oil_control: "控油需求", dark_circles: "黑眼圈", roughness: "粗糙肤质",
        waterOil: "水油失衡",
    };
    return labels[concern] || concern;
}

/** persona key → 中文名 */
export function getPersonaLabelFromKey(persona?: string): string {
    const map: Record<string, string> = {
        sensitive: "敏敏派",
        minimalist: "极简派",
        luxury: "奢华派",
        ageless: "冻龄派",
        desert: "沙漠派",
        oily: "油条派",
        combination: "混合派",
        guardian: "守护派",
    };
    return persona ? (map[persona] || persona) : "用户";
}
