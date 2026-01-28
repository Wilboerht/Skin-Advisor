/**
 * Prisma 客户端配置 (PostgreSQL / Supabase 模式)
 * 
 * 使用 @prisma/adapter-pg 连接池，适用于 Serverless 环境 (Vercel)
 */
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const prismaClientSingleton = () => {
    // 确保已配置 DATABASE_URL
    const connectionString = process.env.DATABASE_URL;

    // 如果没有配置 URL (可能是本地构建阶段)，返回一个占位符或报错警告
    // 注意：在 build 阶段 npx prisma generate 不需要实际连接，但运行时需要
    if (!connectionString) {
        if (process.env.NODE_ENV === "production") {
            console.error("❌ 错误: 未配置 DATABASE_URL 环境变量");
        }
        // 回退到普通初始化，或者抛出错误，视情况而定
        // 这里为了防止构建在无 env 情况下完全失败，允许空 client (但在调用时会挂)
        return new PrismaClient();
    }

    // 此时我们假设是 PostgreSQL 连接
    // 如果你的 URL 是 postgresql://...

    const pool = new Pool({ connectionString });
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
