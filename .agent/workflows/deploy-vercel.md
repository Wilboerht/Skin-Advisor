---
description: 如何部署到云服务器 (PostgreSQL + 阿里云 OSS)
---

# 部署到云服务器

本项目使用**本地 SQLite 开发 + 生产 PostgreSQL 部署**的混合模式。

## 本地开发

本地开发默认使用 SQLite，**无需任何配置**。直接运行：

```bash
npm run dev
```

## 生产部署

### 1. 环境变量配置

创建 `.env` 文件，配置以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `postgresql://...` | PostgreSQL 连接字符串 |
| `QWEN_API_KEY` | `sk-xxx` | 通义千问 API Key |
| `JWT_SECRET` | `your-secret` | JWT 密钥 |
| `ALI_OSS_REGION` | `oss-cn-xxx` | 阿里云 OSS 区域 |
| `ALI_OSS_ACCESS_KEY_ID` | `xxx` | 阿里云 Access Key |
| `ALI_OSS_ACCESS_KEY_SECRET` | `xxx` | 阿里云 Secret Key |
| `ALI_OSS_BUCKET` | `your-bucket` | OSS Bucket 名称 |

### 2. 构建与启动

```bash
# 安装依赖
npm install

# 同步数据库结构
npx prisma db push
npx prisma generate

# 构建
npm run build

# 使用 PM2 启动
pm2 start ecosystem.config.js
```

### 3. Nginx 反向代理配置

配置 Nginx 反向代理到应用端口（如 3002），并设置静态资源缓存。

## 注意事项

1. **生产环境使用 PostgreSQL**，确保数据库服务已启动
2. **图片存储使用阿里云 OSS**，确保 OSS 配置正确
3. **定时任务使用 Linux Crontab**，替代 Vercel Cron
