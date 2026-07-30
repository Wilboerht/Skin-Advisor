#!/usr/bin/env node
/**
 * 构建后脚本：将 public/ 和 .next/static/ 复制到 .next/standalone/
 *
 * Next.js standalone 模式不会自动包含静态文件，
 * 必须手动复制才能让 server.js 正确提供静态资源。
 *
 * 此脚本由 package.json 的 "postbuild" 自动调用。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STANDALONE = path.join(ROOT, '.next', 'standalone');

if (!fs.existsSync(STANDALONE)) {
  console.log('⚠️  .next/standalone 不存在，跳过静态文件复制（非 standalone 构建）');
  process.exit(0);
}

/**
 * 递归复制目录
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. 复制 public/ → .next/standalone/public/
const publicSrc = path.join(ROOT, 'public');
const publicDest = path.join(STANDALONE, 'public');
if (fs.existsSync(publicSrc)) {
  console.log('📦 复制 public/ → .next/standalone/public/ ...');
  copyDir(publicSrc, publicDest);
  console.log('   ✅ public/ 复制完成');
} else {
  console.log('⚠️  public/ 目录不存在，跳过');
}

// 2. 复制 .next/static/ → .next/standalone/.next/static/
const staticSrc = path.join(ROOT, '.next', 'static');
const staticDest = path.join(STANDALONE, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  console.log('📦 复制 .next/static/ → .next/standalone/.next/static/ ...');
  copyDir(staticSrc, staticDest);
  console.log('   ✅ .next/static/ 复制完成');
} else {
  console.log('⚠️  .next/static/ 目录不存在，跳过');
}

console.log('\n✅ standalone 静态文件准备完成！');
console.log('   部署时只需上传 .next/standalone/ 目录 + .env.production');
