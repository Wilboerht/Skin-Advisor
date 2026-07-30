/**
 * Prisma 配置文件
 * Prisma 7.x 使用 prisma.config.ts 管理数据源配置
 * 
 * 本地开发: 自动使用 SQLite (file:./prisma/dev.db)
 * 生产环境: 使用 PostgreSQL (通过环境变量)
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

  // 默认: 本地 SQLite
  return "file:./prisma/dev.db";
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
