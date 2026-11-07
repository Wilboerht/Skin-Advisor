/**
 * Prisma 配置文件
 * Prisma 7.x 使用 prisma.config.ts 管理数据源配置
 *
 * 数据库统一使用 PostgreSQL（schema provider = postgresql），
 * 需通过 DIRECT_URL 或 DATABASE_URL 环境变量提供连接串。
 *
 * 环境加载策略（避免开发机误连生产库）：
 * - 开发环境只加载 .env.local / .env，绝不自动读取 .env.production；
 * - 生产命令由 scripts/prepare-production.js 先把 .env.production 注入 process.env；
 * - 为 `prisma generate` 等无需连接数据库的命令保留占位 URL，
 *   真正连接时由命令自身报错，而不是在加载配置阶段直接崩溃。
 */
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// 已有显式注入的环境变量（CI/PM2/prepare-production）优先，不再读本地 env 文件；
// 仅在开发机未提供连接串时才加载 .env.local/.env，绝不自动读取 .env.production。
if (!process.env.DATABASE_URL && !process.env.DIRECT_URL && process.env.NODE_ENV !== "production") {
    config({ path: ".env.local", override: true });
    config({ path: ".env" });
}

const PLACEHOLDER_DATABASE_URL = "postgresql://unused:unused@localhost:5432/unused";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "tsx prisma/seed.ts",
    },
    datasource: {
        url: process.env.DIRECT_URL || process.env.DATABASE_URL || PLACEHOLDER_DATABASE_URL,
    },
});
