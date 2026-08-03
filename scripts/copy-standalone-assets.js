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
 * @param {string} src 源目录
 * @param {string} dest 目标目录
 * @param {Set<string>} exclude 要排除的目录/文件名集合
 */
function copyDir(src, dest, exclude = new Set()) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.has(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    // 使用 statSync 跟随符号链接判断真实类型
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath, exclude);
    } else if (stat.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
    // 跳过其他类型（socket、fifo 等）
  }
}

// 1. 复制 public/ → .next/standalone/public/（排除 uploads，避免把上传文件打包进构建产物）
const publicSrc = path.join(ROOT, 'public');
const publicDest = path.join(STANDALONE, 'public');
if (fs.existsSync(publicSrc)) {
  console.log('📦 复制 public/ → .next/standalone/public/ ...');
  copyDir(publicSrc, publicDest, new Set(['uploads']));
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

// 3. 建立 uploads 符号链接：.next/standalone/public/uploads → 源码 public/uploads
// 原因：standalone 运行时 process.cwd() 是 .next/standalone，上传文件会写入该目录；
// Nginx /uploads/ 也可能映射到这里。通过符号链接让上传文件始终落到源码目录的持久化位置，
// 避免每次重新部署后展品图等上传文件全部 404。
const uploadsSrc = path.join(publicSrc, 'uploads');
const uploadsDest = path.join(publicDest, 'uploads');
try {
  fs.mkdirSync(uploadsSrc, { recursive: true });
  if (fs.existsSync(uploadsDest) || fs.lstatSync(uploadsDest, { throwIfNoEntry: false })) {
    const destStat = fs.lstatSync(uploadsDest);
    if (destStat.isSymbolicLink()) {
      console.log('🔗 uploads 符号链接已存在，跳过');
    } else if (destStat.isDirectory()) {
      // standalone 目录里已有真实 uploads（历史上传），先合并回源码目录再替换为链接
      console.log('📦 合并 standalone/public/uploads 中已有文件 → public/uploads ...');
      copyDir(uploadsDest, uploadsSrc);
      fs.rmSync(uploadsDest, { recursive: true, force: true });
      fs.symlinkSync(uploadsSrc, uploadsDest, 'junction');
      console.log('   ✅ uploads 已合并并替换为符号链接');
    }
  } else {
    fs.symlinkSync(uploadsSrc, uploadsDest, 'junction');
    console.log('🔗 已创建符号链接 .next/standalone/public/uploads → public/uploads');
  }
} catch (err) {
  console.log('⚠️  uploads 符号链接创建失败（不影响构建）：', err.message);
}

console.log('\n✅ standalone 静态文件准备完成！');
console.log('   部署时只需上传 .next/standalone/ 目录 + .env.production');
