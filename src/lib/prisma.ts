/**
 * Prisma 客户端配置 (PostgreSQL / Supabase)
 */
import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
    const url = process.env.DATABASE_URL;

    if (!url) {
        throw new Error("DATABASE_URL environment variable is not set");
    }

    const { Pool } = require("pg");
    const { PrismaPg } = require("@prisma/adapter-pg");

    // 优化 Supabase PostgreSQL 连接池配置
    const pool = new Pool({
        connectionString: url,
        max: 10, 
        min: 0, // 允许在空闲时完全关闭连接，防止被 Supabase 强行释放时产生报错
        idleTimeoutMillis: 30000, // 缩短空闲超时到 30 秒
        connectionTimeoutMillis: 30000, 
        statement_timeout: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
    });

    // 监听连接池错误
    pool.on("error", (err: Error) => {
        // 只记录非预期终端错误，连接重置在池中是常见的
        if (err.message.includes("Connection terminated unexpectedly")) {
            console.warn("[Prisma Pool] Idle connection closed by server (expected behavior for Supabase/PgBouncer)");
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
