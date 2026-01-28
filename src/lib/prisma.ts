/**
 * Prisma 客户端配置
 * Prisma 7.x 使用 driver adapter 连接数据库
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// 获取数据库 URL
const databaseUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";

const prismaClientSingleton = () => {
    // 使用 libsql adapter 连接 SQLite 数据库
    const adapter = new PrismaLibSql({ url: databaseUrl });
    return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
