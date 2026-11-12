/** RecommendationRule 条件匹配（纯函数）。 */

export interface RuleConditions {
    skinType?: string[];
    concern?: string[];
    persona?: string[];
}

/** 检查规则条件是否匹配当前用户 */
export function ruleMatches(
    rawConditions: unknown,
    skinType: string,
    concerns: string[],
    persona?: string
): boolean {
    if (!rawConditions || typeof rawConditions !== 'object' || Array.isArray(rawConditions)) return false;
    const conditions = rawConditions as RuleConditions;
    if (conditions.skinType?.length && !conditions.skinType.includes(skinType)) return false;
    if (conditions.concern?.length && !concerns.some(c => conditions.concern!.includes(c))) return false;
    if (conditions.persona?.length && (!persona || !conditions.persona.includes(persona))) return false;
    return true;
}

/** 判断规则是否包含 persona 条件 */
export function ruleHasPersonaCondition(rawConditions: unknown): boolean {
    if (!rawConditions || typeof rawConditions !== 'object' || Array.isArray(rawConditions)) return false;
    const conditions = rawConditions as RuleConditions;
    return !!conditions.persona?.length;
}
