/**
 * Prisma 客户端配置 (PostgreSQL)
 * 
 * 部署环境：云服务器（单实例常驻进程，PM2 fork 模式）
 * 连接池针对常驻进程优化，无需考虑 Serverless 冷启动问题。
 */
import { PrismaClient } from "@prisma/client";

/**
 * 当 DATABASE_URL 未设置时，返回一个 PrismaClient 空壳（stub）。
 * 模块可以正常加载，但所有 DB 操作都会返回 rejected Promise。
 * 这样不连数据库也能启动开发服务器，适合纯前端样式调试。
 */
function createPrismaStub(): PrismaClient {
    const handler: ProxyHandler<object> = {
        get(_, prop) {
            if (prop === "$disconnect") return () => Promise.resolve();
            if (prop === "then") return undefined;
            if (prop === "catch") return undefined;
            if (prop === "finally") return undefined;
            return new Proxy(() => {}, handler) as unknown;
        },
        apply() {
            return Promise.reject(
                new Error("DATABASE_URL is not set")
            );
        },
    };
    return new Proxy({} as object, handler) as PrismaClient;
}

const prismaClientSingleton = () => {
    const url = process.env.DATABASE_URL;

    if (!url) {
        console.warn(
            "[Prisma] DATABASE_URL is not set. Returning a stub client. DB operations will fail."
        );
        return createPrismaStub();
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");

    // PostgreSQL 连接池配置（常驻进程优化）
    const pool = new Pool({
        connectionString: url,
        max: 10,
        min: 2, // 保持最小连接以减少请求延迟
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
    });

    // 监听连接池错误
    pool.on("error", (err: Error) => {
        // 只记录非预期终端错误，连接重置在池中是常见的
        if (err.message.includes("Connection terminated unexpectedly")) {
            console.warn("[Prisma Pool] Idle connection closed by server");
            return;
        }
        console.error("[Prisma Pool] Unexpected error:", err.message);
    });

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// 优雅关闭信号处理已移至 instrumentation.ts（Node.js runtime only），
// 避免 Edge Runtime 静态分析时检测到 process.on。
