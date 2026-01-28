/**
 * Prisma 配置文件
 * Prisma 7.x 使用 prisma.config.ts 管理数据源配置
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // 使用 DIRECT_URL 用于 CLI 操作 (migrations)
    // 运行时的 PrismaClient 仍使用 DATABASE_URL
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "file:./prisma/dev.db",
  },
});
