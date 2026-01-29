/**
 * Prisma 客户端配置 (本地 SQLite 模式)
 * 
 * 使用 @prisma/adapter-libsql 连接本地文件数据库
 */
import { PrismaClient } from "@prisma/client";
// import { PrismaLibSql } from "@prisma/adapter-libsql";

const prismaClientSingleton = () => {
    // 获取数据库 URL
    const url = process.env.DATABASE_URL || "file:./prisma/dev.db";

    // 判断是否为 Postgres (Supabase)
    const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");

    if (isPostgres) {
        const { Pool } = require("pg");
        const { PrismaPg } = require("@prisma/adapter-pg");

        const pool = new Pool({ connectionString: url });
        const adapter = new PrismaPg(pool);
        return new PrismaClient({ adapter });
    } else {
        // 默认: 本地 SQLite (LibSQL)
        // 注意：PrismaLibSql 需要导入
        const { PrismaLibSql } = require("@prisma/adapter-libsql");
        const adapter = new PrismaLibSql({ url });
        return new PrismaClient({ adapter });
    }
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
