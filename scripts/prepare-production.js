#!/usr/bin/env node
/**
 * 生产环境准备脚本
 * 
 * 在 Vercel 构建时自动执行：
 * 1. 验证环境变量
 * 2. 将 schema.prisma 的 provider 从 sqlite 切换为 postgresql
 * 3. 更新 prisma.config.ts 确保使用正确的数据源
 * 4. 执行 prisma generate
 * 5. 执行 prisma db push (使用 DIRECT_URL 直连)
 * 
 * 使用方法：
 * - Vercel Build Command: node scripts/prepare-production.js && next build
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const CONFIG_PATH = path.join(__dirname, '..', 'prisma.config.ts');

console.log('🚀 准备生产环境...\n');

// ========================================
// 0. 验证必要的环境变量
// ========================================
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

// 验证端口是否正确
const directUrlPort = process.env.DIRECT_URL.match(/:(\d+)\//)?.[1];
if (directUrlPort === '6543') {
  console.warn('   ⚠️ 警告: DIRECT_URL 使用了端口 6543 (Pooler)，应该使用端口 5432 (直连)');
}

console.log('   ✅ DATABASE_URL: ' + process.env.DATABASE_URL.substring(0, 50) + '...');
console.log('   ✅ DIRECT_URL: ' + process.env.DIRECT_URL.substring(0, 50) + '...\n');

// ========================================
// 1. 修改 schema.prisma 的 datasource 块
// ========================================
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

// ========================================
// 2. 更新 prisma.config.ts
// ========================================
console.log('📝 更新 prisma.config.ts...');
// 注意：prisma db push 需要使用 DIRECT_URL，所以这里 url 设置为 DIRECT_URL
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
    // 使用 DIRECT_URL (端口 5432) 用于 Prisma CLI 操作
    url: process.env.DIRECT_URL,
  },
});
`;

fs.writeFileSync(CONFIG_PATH, newConfigContent, 'utf-8');
console.log('   ✅ prisma.config.ts 已更新 (使用 DIRECT_URL)\n');

// ========================================
// 3. 执行 prisma generate
// ========================================
console.log('⚙️ 执行 prisma generate...');
try {
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('   ✅ prisma generate 完成\n');
} catch (error) {
  console.error('   ❌ prisma generate 失败');
  process.exit(1);
}

// ========================================
// 4. 执行 prisma db push
// ========================================
console.log('⚙️ 执行 prisma db push...');
console.log('   📡 连接到: ' + process.env.DIRECT_URL.replace(/:[^:@]+@/, ':****@').substring(0, 60) + '...');
try {
  execSync('npx prisma db push', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('   ✅ prisma db push 完成\n');
} catch (error) {
  console.error('   ❌ prisma db push 失败');
  process.exit(1);
}

// ========================================
// 5. 恢复 prisma.config.ts 用于运行时
// ========================================
console.log('📝 恢复 prisma.config.ts 用于运行时...');
const runtimeConfigContent = `/**
 * Prisma 配置文件 (生产环境 - 运行时)
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
    // 运行时使用 DATABASE_URL (Pooler, 端口 6543)
    url: process.env.DATABASE_URL,
  },
});
`;

fs.writeFileSync(CONFIG_PATH, runtimeConfigContent, 'utf-8');
console.log('   ✅ prisma.config.ts 已恢复为运行时配置\n');

console.log('✅ 生产环境准备完成！');
console.log('   下一步: next build\n');
