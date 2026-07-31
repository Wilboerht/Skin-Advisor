---
description: 云服务器部署指南 (PostgreSQL + PM2 + Nginx)
---

# 云服务器部署指南

本项目部署在**云服务器**上，使用 PM2 常驻进程管理，不再使用 Vercel / Supabase。

## 部署架构

- **应用服务**: Next.js standalone + PM2 fork 模式（单实例）
- **数据库**: PostgreSQL（云数据库或本地安装）
- **文件存储**: 阿里云 OSS（推荐）或本地磁盘
- **定时任务**: Linux Crontab（替代 Vercel Cron）
- **反向代理**: Nginx

## 环境要求

- Node.js 20+
- PostgreSQL 14+
- PM2 (`npm install -g pm2`)
- Nginx（生产环境推荐）

## 本地开发

本地开发默认使用 SQLite，**无需 PostgreSQL**。

```bash
npm install
npm run dev
```

## 生产部署

### 1. 环境变量配置

创建 `.env` 文件，配置以下环境变量：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串 |
| `JWT_SECRET` | ✅ | JWT 密钥（与官网保持一致） |
| `ADMIN_SESSION_SECRET` | ✅ | 管理员会话密钥 |
| `CRON_SECRET` | ✅ | Cron 任务安全密钥 |
| `QWEN_API_KEY` | ✅ | 通义千问 API Key |
| `OFFICIAL_API_URL` | ✅ | 官网 API 地址（如 `https://nihplod.cn`） |
| `ALI_OSS_REGION` | ❌ | 阿里云 OSS 区域 |
| `ALI_OSS_ACCESS_KEY_ID` | ❌ | 阿里云 Access Key |
| `ALI_OSS_ACCESS_KEY_SECRET` | ❌ | 阿里云 Secret Key |
| `ALI_OSS_BUCKET` | ❌ | OSS Bucket 名称 |
| `WECHAT_APP_ID` | ❌ | 微信公众号 AppID |
| `WECHAT_APP_SECRET` | ❌ | 微信公众号 AppSecret |

### 2. 构建与启动

```bash
# 安装依赖
npm install

# 准备生产环境（验证变量 + 生成客户端 + 应用迁移）
node scripts/prepare-production.js

# 构建
npm run build

# 使用 PM2 启动
pm2 start ecosystem.config.js

# 保存 PM2 配置（开机自启）
pm2 save
pm2 startup
```

### 3. Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        alias /path/to/your/project/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. 定时任务配置（Crontab）

替代 Vercel Cron，使用 Linux Crontab：

```bash
# 编辑 crontab
crontab -e
```

添加以下内容（将 `YOUR_CRON_SECRET` 和域名替换为实际值）：

```cron
# 数据清理（每 30 分钟）
*/30 * * * * curl -s "https://your-domain.com/api/cron/data-cleanup?secret=YOUR_CRON_SECRET" >> /var/log/skin-advisor/cron-cleanup.log 2>&1
```

创建日志目录：

```bash
sudo mkdir -p /var/log/skin-advisor
sudo chown $(whoami):$(whoami) /var/log/skin-advisor
```

## 注意事项

1. **PM2 必须使用 fork 模式 + 单实例**（`instances: 1, exec_mode: 'fork'`）。当前应用使用内存中限流器，cluster 模式会导致多个进程竞争处理同一限流计数。
2. **生产环境必须使用 PostgreSQL**，SQLite 仅用于本地开发。
3. **图片存储推荐使用阿里云 OSS**。如果使用本地存储，确保 `public/uploads` 目录有持久化存储（云服务器本地磁盘即可）。
4. **内存限流限制**：当前 `ratelimit.ts` 使用进程内内存 Map，仅在单实例部署下有效。如需水平扩展，需迁移到 Redis。
5. **SSL 证书**：生产环境必须使用 HTTPS，确保证书有效。
