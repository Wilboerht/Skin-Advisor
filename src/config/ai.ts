/**
 * AI 服务中心化配置
 * 所有可调参数集中在这里，运维只需看这一个文件。
 */

// ============================================================================
// 队列并发
// ============================================================================

/** 通用/文本分析队列最大并发数（check-config 等） */
export const AI_QUEUE_MAX_CONCURRENT = parseEnvInt("AI_QUEUE_MAX_CONCURRENT", 15);

/** 综合分析队列最大并发数（LLM 长文本，独立于通用队列） */
export const AI_ANALYSIS_QUEUE_MAX_CONCURRENT = parseEnvInt("AI_ANALYSIS_QUEUE_MAX_CONCURRENT", 18);

/** 视觉分析队列最大并发数 */
export const AI_VISION_QUEUE_MAX_CONCURRENT = parseEnvInt("AI_VISION_QUEUE_MAX_CONCURRENT", 12);

/** 单用户最大并发 AI 请求数 */
export const AI_MAX_CONCURRENT_PER_USER = parseEnvInt("AI_MAX_CONCURRENT_PER_USER", 1);

/** 队列最大排队数 */
export const AI_QUEUE_MAX_LENGTH = parseEnvInt("AI_QUEUE_MAX_LENGTH", 100);

/** 视觉队列最大排队数 */
export const AI_VISION_QUEUE_MAX_LENGTH = parseEnvInt("AI_VISION_QUEUE_MAX_LENGTH", 100);

// ============================================================================
// 预算熔断
// ============================================================================

/** 每日 token 预算（单位：tokens，0 = 不限制） */
export const AI_DAILY_TOKEN_BUDGET = parseEnvIntOptional("AI_DAILY_TOKEN_BUDGET") ?? 500000;

/** 每日费用预算（单位：元，0 = 不限制） */
export const AI_DAILY_COST_BUDGET_CNY = parseEnvFloatOptional("AI_DAILY_COST_BUDGET_CNY") ?? 200;

/** 每月 token 预算 */
export const AI_MONTHLY_TOKEN_BUDGET = parseEnvIntOptional("AI_MONTHLY_TOKEN_BUDGET") ?? 10000000;

/** 每月费用预算 */
export const AI_MONTHLY_COST_BUDGET_CNY = parseEnvFloatOptional("AI_MONTHLY_COST_BUDGET_CNY") ?? 500;

/** 单用户每日 AI 调用次数上限 */
export const USER_DAILY_AI_CALL_LIMIT = parseEnvInt("AI_USER_DAILY_CALL_LIMIT", 30);

// ============================================================================
// 熔断器
// ============================================================================

/** 连续失败次数阈值，超过后熔断 */
export const CIRCUIT_FAILURE_THRESHOLD = parseEnvInt("AI_CIRCUIT_FAILURE_THRESHOLD", 5);

/** 熔断后冷却时间（毫秒） */
export const CIRCUIT_COOLDOWN_MS = parseEnvInt("AI_CIRCUIT_COOLDOWN_MS", 60000);

/** 半开状态下允许的最大探测请求数 */
export const CIRCUIT_HALF_OPEN_MAX = parseEnvInt("AI_CIRCUIT_HALF_OPEN_MAX", 2);

/** 失败计数窗口（毫秒），超过此窗口的旧失败不计入 */
export const CIRCUIT_FAILURE_WINDOW_MS = parseEnvInt("AI_CIRCUIT_FAILURE_WINDOW_MS", 120000);

// ============================================================================
// 速率限制
// ============================================================================

/** 面部分析每 IP 每小时限制 */
export const FACE_ANALYZE_RATE_LIMIT = parseEnvInt("AI_FACE_ANALYZE_RATE_LIMIT_PER_HOUR", 20);

/** 综合分析每 IP 每小时限制 */
export const COMPREHENSIVE_ANALYZE_RATE_LIMIT = parseEnvInt("AI_COMPREHENSIVE_RATE_LIMIT_PER_HOUR", 20);

// ============================================================================
// Key 健康检查
// ============================================================================

/** Key 连续失败后冷却时间（毫秒） */
export const KEY_HEALTH_COOLDOWN_MS = parseEnvInt("AI_KEY_HEALTH_COOLDOWN_MS", 300000);

/** 连续失败次数进入冷却 */
export const KEY_HEALTH_MAX_FAILURES = parseEnvInt("AI_KEY_HEALTH_MAX_FAILURES", 3);

/** 连续 429 次数进入冷却 */
export const KEY_HEALTH_MAX_RATE_LIMITS = parseEnvInt("AI_KEY_HEALTH_MAX_RATE_LIMITS", 2);

// ============================================================================
// 工具函数
// ============================================================================

function parseEnvInt(key: string, fallback: number): number {
    try {
        const raw = process.env[key];
        if (raw === undefined || raw === "") return fallback;
        const val = parseInt(raw, 10);
        return isNaN(val) || val < 1 ? fallback : val;
    } catch {
        return fallback;
    }
}

function parseEnvIntOptional(key: string): number | undefined {
    try {
        const raw = process.env[key];
        if (raw === undefined || raw === "") return undefined;
        const val = parseInt(raw, 10);
        return isNaN(val) || val < 0 ? undefined : val;
    } catch {
        return undefined;
    }
}

function parseEnvFloatOptional(key: string): number | undefined {
    try {
        const raw = process.env[key];
        if (raw === undefined || raw === "") return undefined;
        const val = parseFloat(raw);
        return isNaN(val) || val < 0 ? undefined : val;
    } catch {
        return undefined;
    }
}
