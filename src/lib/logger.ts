
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

    let log = `${levelIcon} [${timestamp}] [${module}] ${message}`;

    if (context && Object.keys(context).length > 0) {
        // 对敏感信息进行脱敏
        const sanitizedContext = sanitizeContext(context);
        log += `\n   ${JSON.stringify(sanitizedContext, null, 2).replace(/\n/g, "\n   ")}`;
    }

    return log;
}

/**
 * 脱敏处理敏感信息
 */
function sanitizeContext(context: LogContext): LogContext {
    const sensitiveKeys = [
        "apiKey", "apikey", "secret", "password", "token", "authorization",
        "phone", "phonenumber", "cookie", "session", "jwt", "signature",
        "refreshtoken", "creditcard", "ssn", "passport",
        "privatekey", "private_key",
    ];
    const sanitized: LogContext = {};

    for (const [key, value] of Object.entries(context)) {
        if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
            sanitized[key] = "[REDACTED]";
        } else if (typeof value === "string" && value.length > 500) {
            // 截断过长的字符串
            sanitized[key] = value.substring(0, 500) + "...[truncated]";
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
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
        return { message: context.slice(0, 500) };
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
