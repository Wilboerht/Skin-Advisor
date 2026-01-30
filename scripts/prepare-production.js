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

// 1. 修改 schema.prisma 的 provider
console.log('📝 更新 prisma/schema.prisma...');
let schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// 替换 provider
schemaContent = schemaContent.replace(
    /provider\s*=\s*"sqlite"/,
    'provider = "postgresql"'
);

fs.writeFileSync(SCHEMA_PATH, schemaContent, 'utf-8');
console.log('   ✅ provider 已切换为 postgresql\n');

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
    url: process.env.DATABASE_URL,
  },
});
`;

fs.writeFileSync(CONFIG_PATH, newConfigContent, 'utf-8');
console.log('   ✅ prisma.config.ts 已更新\n');

console.log('✅ 生产环境准备完成！');
console.log('   下一步: npx prisma generate && npx prisma db push && next build\n');
