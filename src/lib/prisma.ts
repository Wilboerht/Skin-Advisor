// Prisma 7.x 需要使用 driver adapter
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const prismaClientSingleton = () => {
    // 使用 libsql adapter 连接 SQLite 数据库
    const adapter = new PrismaLibSql({
        url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
    });
    return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
