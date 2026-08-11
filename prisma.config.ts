/**
 * Prisma 配置文件
 * Prisma 7.x 使用 prisma.config.ts 管理数据源配置
 *
 * 数据库统一使用 PostgreSQL（schema provider = postgresql），
 * 需通过 DIRECT_URL 或 DATABASE_URL 环境变量提供连接串。
 */
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// 加载顺序：.env.production → .env → .env.local（后加载的覆盖先加载的）
config({ path: ".env.production" });
config({ path: ".env" });
if (process.env.NODE_ENV !== "production") {
    config({ path: ".env.local", override: true });
}

// 获取数据库 URL
const getDatabaseUrl = () => {
  // 优先使用 DIRECT_URL（用于 Prisma CLI 操作）
  if (process.env.DIRECT_URL) {
    return process.env.DIRECT_URL;
  }

  // 其次使用 DATABASE_URL
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // 未配置时给出明确报错（schema 为 postgresql，不能回退到 SQLite URL）
  throw new Error(
    "DATABASE_URL 未配置：请在 .env.local 或 .env.production 中设置 DATABASE_URL（PostgreSQL 连接串）"
  );
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx -y tsx prisma/seed.ts",
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});
