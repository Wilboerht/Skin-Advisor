
/**
 * 结构化日志工具
 *
 * 提供统一的日志格式，便于调试和监控
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
    [key: string]: unknown;
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    module: string;
    message: string;
    context?: LogContext;
}

/**
 * 格式化日志条目
 */
function formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, module, message, context } = entry;
    const levelIcon = {
        debug: "🔍",
        info: "ℹ️",
        warn: "⚠️",
        error: "❌",
    }[level];

    let log = `${levelIcon} [${timestamp}] [${module}] ${redactLogText(message)}`;

    if (context && Object.keys(context).length > 0) {
        // 对敏感信息进行脱敏
        const sanitizedContext = sanitizeContext(context);
        log += `\n   ${JSON.stringify(sanitizedContext, null, 2).replace(/\n/g, "\n   ")}`;
    }

    return log;
}

const SENSITIVE_KEYS = [
    "apiKey", "apikey", "secret", "password", "token", "authorization",
    "phone", "phonenumber", "cookie", "jwt", "signature",
    "refreshtoken", "creditcard", "ssn", "passport",
    "privatekey", "private_key", "sessiontoken", "sessionsecret",
];

/**
 * 对日志字符串做最后一道脱敏：消息体里直接拼进去的手机号、IP、
 * Bearer token、JWT、API key 等也必须处理，不能只依赖 context key。
 */
export function redactLogText(input: string): string {
    let text = input;
    text = text.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]");
    text = text.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]");
    text = text.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-[REDACTED]");
    text = text.replace(/\bAKIA[0-9A-Z]{12,}\b/g, "[REDACTED_ACCESS_KEY]");
    text = text.replace(/([?&\s](?:token|secret|key|apikey|api_key|password)=)[^&\s]+/gi, "$1[REDACTED]");
    // 中国大陆手机号；前后不能是数字，避免误伤普通长数字
    text = text.replace(/(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g, "[REDACTED_PHONE]");
    // IPv4 / 常见 IPv6；日志里不需要原始来源 IP
    text = text.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]");
    text = text.replace(/\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi, "[REDACTED_IP]");
    return text;
}

function shouldRedactKey(key: string): boolean {
    if (key.endsWith("Name") || key.endsWith("Names")) return false;
    return SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive));
}

function sanitizeValue(value: unknown, key = "", depth = 0): unknown {
    if (depth > 5) return "[TRUNCATED_DEPTH]";
    if (typeof value === "string") {
        const redacted = redactLogText(value);
        return redacted.length > 500 ? redacted.substring(0, 500) + "...[truncated]" : redacted;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.slice(0, 50).map((item) => sanitizeValue(item, key, depth + 1));
    }
    if (typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
            if (shouldRedactKey(childKey)) {
                out[childKey] = "[REDACTED]";
            } else {
                out[childKey] = sanitizeValue(childValue, childKey, depth + 1);
            }
        }
        return out;
    }
    return String(value);
}

/** 供 console 兜底包装复用：递归脱敏任意日志参数 */
export function redactLogValue(value: unknown): unknown {
    return sanitizeValue(value);
}

/**
 * 脱敏处理敏感信息（递归处理嵌套对象/数组）
 */
function sanitizeContext(context: LogContext): LogContext {
    return sanitizeValue(context) as LogContext;
}

/**
 * 将任意类型的 context 规范化为 LogContext
 */
function normalizeContext(context?: unknown): LogContext | undefined {
    if (context === undefined || context === null) return undefined;
    if (context instanceof Error) {
        return { error: context.message, stack: context.stack?.split("\n").slice(0, 3).join("\n") };
    }
    if (typeof context === "string") {
        return { message: redactLogText(context).slice(0, 500) };
    }
    if (typeof context === "number" || typeof context === "boolean") {
        return { value: context };
    }
    if (typeof context === "object") {
        return sanitizeContext(context as LogContext);
    }
    return { value: String(context).slice(0, 500) };
}

/**
 * 创建模块化日志器
 */
function createLogger(module: string) {
    const log = (level: LogLevel, message: string, context?: unknown) => {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            module,
            message,
            context: normalizeContext(context),
        };

        const formattedLog = formatLogEntry(entry);

        switch (level) {
            case "debug":
                if (process.env.NODE_ENV === "development") {
                    console.debug(formattedLog);
                }
                break;
            case "info":
                console.info(formattedLog);
                break;
            case "warn":
                console.warn(formattedLog);
                break;
            case "error":
                console.error(formattedLog);
                break;
        }
    };

    return {
        debug: (message: string, context?: unknown) => log("debug", message, context),
        info: (message: string, context?: unknown) => log("info", message, context),
        warn: (message: string, context?: unknown) => log("warn", message, context),
        error: (message: string, context?: unknown) => log("error", message, context),
    };
}

/**
 * AI 模块日志器
 */
export const aiLogger = createLogger("AI");

/**
 * API 模块日志器
 */
export const apiLogger = createLogger("API");

/**
 * 数据库模块日志器
 */
export const dbLogger = createLogger("DB");

/**
 * 通用日志器
 */
export const logger = createLogger("App");

/**
 * 请求日志中间件辅助函数
 */
export function logRequest(
    method: string,
    path: string,
    context?: unknown
) {
    apiLogger.info(`${method} ${path}`, context);
}

/**
 * 错误日志辅助函数（包含堆栈信息）
 */
export function logError(
    module: string,
    error: unknown,
    context?: LogContext
) {
    const errorLogger = createLogger(module);
    const errorInfo: LogContext = {
        ...context,
    };

    if (error instanceof Error) {
        errorInfo.errorName = error.name;
        errorInfo.errorMessage = error.message;
        errorInfo.stack = error.stack?.split("\n").slice(0, 5).join("\n");
    } else {
        errorInfo.error = String(error);
    }

    errorLogger.error("An error occurred", errorInfo);
}

let consoleRedactionInstalled = false;

/** 对现有/未来 console.* 调用做最后一道脱敏兜底，避免绕过 logger */
export function installConsoleRedaction(): void {
    if (consoleRedactionInstalled) return;
    consoleRedactionInstalled = true;

    const methods: Array<"log" | "info" | "warn" | "error" | "debug"> = [
        "log", "info", "warn", "error", "debug",
    ];
    for (const method of methods) {
        const original = console[method].bind(console);
        console[method] = (...args: unknown[]) => {
            original(...args.map((arg) => {
                if (typeof arg === "string") return redactLogText(arg);
                if (arg instanceof Error) {
                    const safe = new Error(redactLogText(arg.message));
                    safe.name = arg.name;
                    safe.stack = arg.stack ? redactLogText(arg.stack) : undefined;
                    return safe;
                }
                if (arg && typeof arg === "object") return redactLogValue(arg);
                return arg;
            }));
        };
    }
}
