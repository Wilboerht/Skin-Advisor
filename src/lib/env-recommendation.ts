/**
 * 环境联动产品推荐
 * 根据 UV、湿度、AQI、季节动态调整推荐权重
 */

import { SkincareStep } from './skincare-steps';

export interface EnvironmentData {
    uvIndex: number;
    humidity: number;
    aqi?: number;
    temperature?: number;
    season?: 'spring' | 'summer' | 'autumn' | 'winter';
}

export interface EnvironmentBonus {
    step: SkincareStep;
    bonus: number;
    reason: string;
    priority: 'high' | 'medium' | 'low';
}

/**
 * 根据当前环境计算各步骤的加分
 */
export function calculateEnvironmentBonus(env: EnvironmentData): EnvironmentBonus[] {
    const bonuses: EnvironmentBonus[] = [];

    // ===== UV 高时：防晒优先 =====
    if (env.uvIndex >= 8) {
        bonuses.push({
            step: 'sunscreen',
            bonus: 100,
            reason: `紫外线极强 (UV ${env.uvIndex})，防晒是首要任务`,
            priority: 'high'
        });
    } else if (env.uvIndex >= 6) {
        bonuses.push({
            step: 'sunscreen',
            bonus: 60,
            reason: `紫外线较强 (UV ${env.uvIndex})，建议加强防晒`,
            priority: 'medium'
        });
    } else if (env.uvIndex >= 3) {
        bonuses.push({
            step: 'sunscreen',
            bonus: 30,
            reason: `紫外线中等 (UV ${env.uvIndex})，日常防晒不可少`,
            priority: 'low'
        });
    }

    // ===== 低湿度：保湿优先 =====
    if (env.humidity < 30) {
        bonuses.push({
            step: 'cream',
            bonus: 80,
            reason: `空气极干燥 (湿度 ${env.humidity}%)，需强效保湿`,
            priority: 'high'
        });
        bonuses.push({
            step: 'essence',
            bonus: 50,
            reason: `建议叠加高保湿精华`,
            priority: 'medium'
        });
        bonuses.push({
            step: 'oil',
            bonus: 40,
            reason: `护肤油可增强封闭性`,
            priority: 'medium'
        });
    } else if (env.humidity < 50) {
        bonuses.push({
            step: 'cream',
            bonus: 40,
            reason: `湿度偏低 (${env.humidity}%)，注意保湿`,
            priority: 'medium'
        });
    }

    // ===== 高湿度：控油清爽 =====
    if (env.humidity > 80) {
        bonuses.push({
            step: 'toner',
            bonus: 40,
            reason: `高湿度 (${env.humidity}%)，选择清爽型产品`,
            priority: 'medium'
        });
    }

    // ===== AQI 差：清洁优先 =====
    if (env.aqi && env.aqi > 150) {
        bonuses.push({
            step: 'cleanser',
            bonus: 70,
            reason: `空气污染严重 (AQI ${env.aqi})，深层清洁很重要`,
            priority: 'high'
        });
        bonuses.push({
            step: 'mask',
            bonus: 40,
            reason: `建议定期使用清洁面膜`,
            priority: 'medium'
        });
    } else if (env.aqi && env.aqi > 100) {
        bonuses.push({
            step: 'cleanser',
            bonus: 40,
            reason: `空气质量一般 (AQI ${env.aqi})，注意清洁`,
            priority: 'medium'
        });
    }

    // ===== 季节调整 =====
    if (env.season === 'winter') {
        bonuses.push({
            step: 'cream',
            bonus: 50,
            reason: `冬季干燥，面霜保湿很重要`,
            priority: 'medium'
        });
        bonuses.push({
            step: 'oil',
            bonus: 30,
            reason: `护肤油帮助锁住水分`,
            priority: 'low'
        });
    } else if (env.season === 'summer') {
        bonuses.push({
            step: 'sunscreen',
            bonus: 40,
            reason: `夏季防晒尤为重要`,
            priority: 'medium'
        });
        bonuses.push({
            step: 'toner',
            bonus: 20,
            reason: `选择清爽控油产品`,
            priority: 'low'
        });
    }

    return bonuses;
}

/**
 * 获取当前最需要关注的步骤（用于首页高亮）
 */
export function getTopPriorityStep(env: EnvironmentData): { step: SkincareStep; reason: string } | null {
    const bonuses = calculateEnvironmentBonus(env);
    const highPriority = bonuses.filter(b => b.priority === 'high');

    if (highPriority.length === 0) return null;

    // 返回加分最高的
    highPriority.sort((a, b) => b.bonus - a.bonus);
    return {
        step: highPriority[0].step,
        reason: highPriority[0].reason
    };
}

/**
 * 生成环境相关的推荐理由
 */
export function generateEnvironmentReason(
    step: SkincareStep,
    env: EnvironmentData
): string | null {
    const bonuses = calculateEnvironmentBonus(env);
    const matched = bonuses.find(b => b.step === step);
    return matched?.reason || null;
}

/**
 * 根据环境计算产品最终得分
 */
export function applyEnvironmentBonus(
    productStep: SkincareStep,
    baseScore: number,
    env: EnvironmentData
): { finalScore: number; bonusReason: string | null } {
    const bonuses = calculateEnvironmentBonus(env);
    const matched = bonuses.find(b => b.step === productStep);

    if (matched) {
        return {
            finalScore: baseScore + matched.bonus,
            bonusReason: matched.reason
        };
    }

    return { finalScore: baseScore, bonusReason: null };
}

/**
 * 获取当前季节
 */
export function getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
}
