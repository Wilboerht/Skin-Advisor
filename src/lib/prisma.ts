/**
 * Prisma 客户端配置 (本地 SQLite 模式)
 * 
 * 使用 @prisma/adapter-libsql 连接本地文件数据库
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const prismaClientSingleton = () => {
    // 获取数据库 URL，默认为本地 dev.db
    const url = process.env.DATABASE_URL || "file:./prisma/dev.db";

    // 使用 libsql adapter
    const adapter = new PrismaLibSql({ url });
    return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
