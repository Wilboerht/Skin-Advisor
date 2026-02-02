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
        max: 10, // 增加连接池大小以处理并发请求
        min: 2, // 保持最少 2 个空闲连接
        idleTimeoutMillis: 60000, // 空闲连接 60 秒后关闭
        connectionTimeoutMillis: 30000, // 连接超时增加到 30 秒
        // 查询超时设置（防止长时间查询卡住）
        statement_timeout: 30000,
        // 防止连接被 Supabase 代理意外关闭
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
    });

    // 监听连接池错误
    pool.on("error", (err: Error) => {
        console.error("[Prisma Pool] Unexpected error on idle client:", err.message);
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
