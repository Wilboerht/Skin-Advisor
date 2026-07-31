#!/usr/bin/env node
/**
 * 生产环境准备脚本（云服务器部署）
 *
 * 构建前自动执行：
 * 1. 验证必要的环境变量
 * 2. 执行 prisma generate
 * 3. 执行 prisma migrate deploy（应用已版本控制的迁移文件）
 *
 * 注意：本脚本假定项目已存在 prisma/migrations/ 迁移文件。
 * 如果是首次初始化空数据库且尚未创建迁移，请先在开发环境运行：
 *   npx prisma migrate dev
 * 切勿在生产环境直接运行 prisma db push，否则可能破坏数据。
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

// 检查敏感配置未使用占位值（防止直接复制 .env.example 导致密钥泄露或弱口令）
const PLACEHOLDER_PATTERNS = [
  /^your-.*-here$/i,
  /^CHANGE_ME/i,
  /^123456$/,
  /^password$/i,
  /^admin$/i,
];

function isPlaceholder(value) {
  if (!value) return false;
  return PLACEHOLDER_PATTERNS.some(p => p.test(value.trim()));
}

const secretVars = ['JWT_SECRET', 'ADMIN_SESSION_SECRET', 'CRON_SECRET', 'IP_HASH_SALT', 'ADMIN_SECRET', 'SETUP_SECRET', 'INTERNAL_API_SECRET'];
for (const key of secretVars) {
  const value = process.env[key];
  if (value && isPlaceholder(value)) {
    console.error(`   ❌ 错误: ${key} 使用了占位值或弱口令，请替换为强随机字符串！`);
    hasError = true;
  }
}

// 检查 AI Key：至少配置一个（无 AI Key 会导致分析功能不可用）
const hasAIKey = !!(process.env.QWEN_API_KEY || process.env.DEEPSEEK_API_KEY);
if (!hasAIKey) {
  console.warn('   ⚠️  警告: 未配置 QWEN_API_KEY 或 DEEPSEEK_API_KEY，AI 分析功能将不可用');
}

// 检查 Docker Compose 数据库密码（如果使用 compose）
const postgresPassword = process.env.POSTGRES_PASSWORD || '';
if (postgresPassword && (postgresPassword === 'postgres' || postgresPassword.length < 12)) {
  console.error('   ❌ 错误: POSTGRES_PASSWORD 过于简单，请使用至少 12 位的强随机密码！');
  hasError = true;
}

// 提示移除一次性初始管理员密码
if (process.env.ADMIN_INITIAL_PASSWORD) {
  console.warn('   ⚠️  警告: ADMIN_INITIAL_PASSWORD 已设置。首次 setup 完成后请立即从环境变量中移除该值。');
  if (process.env.ADMIN_INITIAL_PASSWORD.length < 12) {
    console.error('   ❌ 错误: ADMIN_INITIAL_PASSWORD 长度过短（至少 12 位）');
    hasError = true;
  }
}

if (hasError) {
  console.error('\n❌ 环境变量安全检查失败，请配置后重试。');
  process.exit(1);
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
// 3. 执行 prisma migrate deploy
// ========================================
console.log('⚙️  执行 prisma migrate deploy...');
console.log('   📡 连接到:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@').substring(0, 60) + '...');
console.log('   ℹ️  将应用 prisma/migrations/ 下的迁移文件');
try {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('   ✅ prisma migrate deploy 完成\n');
} catch (error) {
  console.error('   ❌ prisma migrate deploy 失败');
  console.error('      如果此前在该数据库上执行过 prisma db push，请先按项目文档处理迁移冲突。');
  process.exit(1);
}

console.log('✅ 生产环境准备完成！');
console.log('   下一步: next build\n');
