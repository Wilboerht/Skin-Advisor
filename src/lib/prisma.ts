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

    const pool = new Pool({
        connectionString: url,
        max: 5, // Limit connections to prevent pool exhaustion
        idleTimeoutMillis: 30000, // Close idle connections after 30s
        connectionTimeoutMillis: 10000, // Timeout if can't connect in 10s
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
