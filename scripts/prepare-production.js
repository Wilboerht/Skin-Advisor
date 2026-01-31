#!/usr/bin/env node
/**
 * 生产环境准备脚本
 * 
 * 在 Vercel 构建时自动执行：
 * 1. 将 schema.prisma 的 provider 从 sqlite 切换为 postgresql
 * 2. 更新 prisma.config.ts 确保使用正确的数据源
 * 
 * 使用方法：
 * - Vercel Build Command: node scripts/prepare-production.js && npx prisma generate && npx prisma db push && next build
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const CONFIG_PATH = path.join(__dirname, '..', 'prisma.config.ts');

console.log('🚀 准备生产环境...\n');

// 0. 验证必要的环境变量
console.log('🔍 检查环境变量...');
if (!process.env.DATABASE_URL) {
  console.error('   ❌ 错误: DATABASE_URL 环境变量未设置！');
  process.exit(1);
}
if (!process.env.DIRECT_URL) {
  console.error('   ❌ 错误: DIRECT_URL 环境变量未设置！');
  console.error('   💡 提示: DIRECT_URL 应该使用端口 5432 (直连)，例如:');
  console.error('      postgresql://user:pass@host:5432/postgres');
  process.exit(1);
}
console.log('   ✅ DATABASE_URL: ' + process.env.DATABASE_URL.substring(0, 50) + '...');
console.log('   ✅ DIRECT_URL: ' + process.env.DIRECT_URL.substring(0, 50) + '...\n');

// 1. 修改 schema.prisma 的 datasource 块
console.log('📝 更新 prisma/schema.prisma...');
let schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// 替换整个 datasource 块 (Prisma 7.x: url 在 prisma.config.ts 中配置)
schemaContent = schemaContent.replace(
  /datasource\s+db\s*\{[^}]*\}/s,
  `datasource db {
  provider = "postgresql"
}`
);

fs.writeFileSync(SCHEMA_PATH, schemaContent, 'utf-8');
console.log('   ✅ datasource 已切换为 postgresql\n');

// 2. 更新 prisma.config.ts
console.log('📝 更新 prisma.config.ts...');
const newConfigContent = `/**
 * Prisma 配置文件 (生产环境)
 * 自动生成 - 请勿手动修改
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // 应用运行时使用 DATABASE_URL (Pooler)
    url: process.env.DATABASE_URL,
    // Prisma CLI 操作使用 DIRECT_URL (直连)
    directUrl: process.env.DIRECT_URL,
  },
});
`;

fs.writeFileSync(CONFIG_PATH, newConfigContent, 'utf-8');
console.log('   ✅ prisma.config.ts 已更新\n');

console.log('✅ 生产环境准备完成！');
console.log('   下一步: npx prisma generate && npx prisma db push && next build\n');
