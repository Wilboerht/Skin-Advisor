#!/usr/bin/env node
/**
 * 生产环境准备脚本（云服务器部署）
 *
 * 构建前自动执行：
 * 1. 验证必要的环境变量
 * 2. 执行 prisma generate
 * 3. 执行 prisma db push（同步数据库结构）
 *
 * 使用方法：
 * - 构建命令: node scripts/prepare-production.js && next build
 * - PM2 启动: pm2 start ecosystem.config.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');

console.log('🚀 准备生产环境...\n');

// ========================================
// 0. 验证必要的环境变量
// ========================================
console.log('🔍 检查环境变量...');

const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_SESSION_SECRET'];
const optionalVars = [
  'CRON_SECRET',
  'OFFICIAL_API_URL',
  'QWEN_API_KEY',
  'ALI_OSS_REGION',
  'WECHAT_APP_ID',
];

let hasError = false;
for (const key of requiredVars) {
  if (!process.env[key]) {
    console.error(`   ❌ 错误: ${key} 环境变量未设置！`);
    hasError = true;
  } else {
    console.log(`   ✅ ${key}: 已设置`);
  }
}

for (const key of optionalVars) {
  if (!process.env[key]) {
    console.warn(`   ⚠️  警告: ${key} 未设置（部分功能将不可用）`);
  } else {
    console.log(`   ✅ ${key}: 已设置`);
  }
}

if (hasError) {
  console.error('\n❌ 环境变量检查失败，请配置后重试。');
  process.exit(1);
}

// 检查数据库 URL 格式
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.startsWith('postgresql://')) {
  console.warn('   ⚠️  警告: DATABASE_URL 不是 PostgreSQL 协议，当前值:', dbUrl.substring(0, 50));
}

console.log();

// ========================================
// 1. 确认 schema.prisma 使用 postgresql
// ========================================
console.log('📝 检查 prisma/schema.prisma...');
let schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');

const providerMatch = schemaContent.match(/provider\s*=\s*"(\w+)"/);
if (providerMatch && providerMatch[1] !== 'postgresql') {
  console.error(`   ❌ 错误: schema.prisma 的 provider 是 "${providerMatch[1]}"，生产环境必须使用 postgresql`);
  process.exit(1);
}
console.log('   ✅ schema.prisma provider 检查通过 (postgresql)\n');

// ========================================
// 2. 执行 prisma generate
// ========================================
console.log('⚙️  执行 prisma generate...');
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
// 3. 执行 prisma db push
// ========================================
console.log('⚙️  执行 prisma db push...');
console.log('   📡 连接到:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@').substring(0, 60) + '...');
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

console.log('✅ 生产环境准备完成！');
console.log('   下一步: next build\n');
