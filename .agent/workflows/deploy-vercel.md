---
description: 如何部署到 Vercel (Supabase PostgreSQL)
---

# 部署到 Vercel

本项目支持**本地 SQLite 开发 + 生产 PostgreSQL 部署**的混合模式。

## 本地开发

本地开发默认使用 SQLite，**无需任何配置**。直接运行：

```bash
npm run dev
```

## 部署到 Vercel

### 1. Vercel 环境变量配置

在 Vercel 项目设置中添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `postgresql://...` | Supabase 连接字符串 (带 pgbouncer) |
| `DIRECT_URL` | `postgresql://...` | Supabase 直连字符串 (端口 5432) |
| `QWEN_API_KEY` | `sk-xxx` | 通义千问 API Key |
| `JWT_SECRET` | `your-secret` | JWT 密钥 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJxxx...` | Supabase Anon Key |

### 2. Vercel Build Command

在 Vercel 项目设置 > Build & Development Settings 中设置：

**Build Command:**
```bash
node scripts/prepare-production.js && next build
```

`prepare-production.js` 脚本会自动：
1. 验证环境变量
2. 将 Prisma schema 的 provider 切换为 `postgresql`
3. 执行 `prisma generate`
4. 执行 `prisma db push` 同步数据库结构
5. 恢复运行时配置

### 3. 部署

直接推送代码到 Git 仓库即可触发 Vercel 自动部署。

## 切换回本地开发

部署完成后，**无需任何操作**！

因为：
- 本地使用 `.env.local` 配置 (SQLite)
- Vercel 构建脚本只在云端执行，不影响本地代码
- Git 会追踪原始的 `sqlite` 配置

如果你在本地不小心运行了 `prepare-production.js`，只需：

```bash
git checkout prisma/schema.prisma prisma.config.ts
npx prisma generate
```

## 注意事项

1. **不要提交生产环境的 schema 变更** - Vercel 构建时会自动处理
2. **本地测试生产构建** - 如需本地测试 PostgreSQL，创建 `.env.production.local` 文件
