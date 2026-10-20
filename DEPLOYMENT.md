# Skin-Advisor 部署与本次修复 Runbook

> 适用路径：`/var/www/Skin-Advisor`，PM2 应用名 `skin-advisor`，端口 3002。

## 1. 部署前检查

```bash
cd /var/www/Skin-Advisor
git status --short
node -v
pm2 describe skin-advisor | grep -Ei "script path|exec cwd|node.js version|max memory"
```

生产环境文件权限（含备份）：

```bash
chmod 600 .env.production .next/standalone/.env.production
chmod 600 .env*.bak* 2>/dev/null || true
# 备份移出应用目录
mkdir -p /root/secure-backups
mv .env*.bak* /root/secure-backups/ 2>/dev/null || true
```

## 2. 构建与重启

> **首次从旧迁移切换到 baseline 时，必须先执行第 3 节的 `prisma migrate resolve --applied`，再运行
> `node scripts/prepare-production.js`。** 否则 prepare 里的 `migrate deploy` 会把 baseline 当成新迁移，
> 在已有表上执行 CREATE TABLE 而失败。全新空库则不要 resolve，直接让 migrate deploy 建表。

```bash
npm ci --legacy-peer-deps --registry=https://registry.npmjs.org
node scripts/prepare-production.js
NODE_OPTIONS=--max-old-space-size=2048 npm run build -- --webpack
pm2 delete skin-advisor 2>/dev/null || true
# 若 3002 仍被旧进程占用（bash -c 包装可能留下孤儿 node）：
#   ss -ltnp | grep ':3002'
#   pkill -f ".next/standalone/server.js"
pm2 start ecosystem.config.js
pm2 save
curl -s http://localhost:3002/api/health
```

> 不要手动 `export INTERNAL_API_KEYS=...`，也不要用 `export $(cat .env.production)`、`xargs`、`tr -d '"'` 注入该变量：这些操作会剥掉 JSON 双引号，导致子站日志 `unknown_key`、主站测肤用量返回 `null`。
> standalone 运行时 `process.cwd()` 是 `.next/standalone/`，实际读取的是 `.next/standalone/.env.production`；`postbuild` 会自动从根目录同步该副本。手动改 env 后未重新 build 时，需 `cp .env.production .next/standalone/.env.production` 再重启。

构建期间不要 `pm2 restart`，避免 `.next/standalone` 重建窗口出现 `Cannot find module` 重启循环。

## 3. 数据库 baseline（P0，需要先备份）

当前仓库已改为单一 PostgreSQL baseline：`prisma/migrations/20261020000000_baseline`。
旧 SQLite 迁移已移到 `prisma/migrations_legacy/`，不参与 `migrate deploy`。

> 现有生产库：先 `pg_dump`，再 `prisma migrate resolve --applied 20261020000000_baseline`，之后才允许
> `migrate deploy` / `prepare-production.js`。
> 全新空库：不要 resolve，直接 `migrate deploy` 让 baseline 建表。

```bash
# 1) 备份生产库（先建目录，避免重定向失败）
mkdir -p /root/secure-backups
set -a; . ./.env.production; set +a
DB_URL="${DATABASE_URL%%\?*}"   # pg_dump 不识别 Prisma 的 ?schema=public
pg_dump "$DB_URL" > "/root/secure-backups/skin_advisor_db_$(date +%Y%m%d_%H%M).sql"
chmod 700 /root/secure-backups
chmod 600 /root/secure-backups/*.sql
ls -lh /root/secure-backups/

# 2) 只在生产库标记 baseline 已应用（不执行建表；生产表已存在）
npx prisma migrate resolve --applied 20261020000000_baseline

# 3) 确认无 pending
npx prisma migrate deploy
npx prisma generate
```

**空库验证**（建议先在临时 PostgreSQL 做一次）：

```bash
DATABASE_URL="postgresql://user:pass@host:5432/empty_test?schema=public" \
  npx prisma migrate deploy
```

## 4. 一次性数据修复

### 4.1 孤儿 TestRecord

先查看再删除。15 条无成功 AI 消费的孤儿预占删除；1 条有视觉成功的删除以返还额度并记录补偿。

```sql
-- 预览
SELECT tr."sessionId", tr."testDate", tr."userId"
FROM "TestRecord" tr
LEFT JOIN "AdvisorSession" s ON s."sessionId" = tr."sessionId"
WHERE s."sessionId" IS NULL
ORDER BY tr."testDate";

-- 删除无成功 AI 的孤儿（cron 也会持续清理 24h 以上的）
DELETE FROM "TestRecord" tr
WHERE NOT EXISTS (SELECT 1 FROM "AdvisorSession" s WHERE s."sessionId" = tr."sessionId")
  AND NOT EXISTS (
    SELECT 1 FROM "AIUsageLog" l
    WHERE l."sessionId" = tr."sessionId" AND l.success = true
  );

-- 补偿：有视觉成功但无会话的 1 条（请先确认 sessionId）
DELETE FROM "TestRecord"
WHERE "sessionId" = '<有视觉成功的孤儿 sessionId>';
```

### 4.2 坏头像置空

```bash
cd /var/www/Skin-Advisor
node scripts/fix-broken-avatars.mjs          # dry-run
node scripts/fix-broken-avatars.mjs --apply  # 确认后执行
```

只处理 `/uploads/...` 与 `https://smart.nihplod.cn/uploads/...`，不动 `https://nihplod.cn/...` 远程头像。

## 5. 验证

```bash
# 健康
curl -s http://localhost:3002/api/health

# 报告页缓存头（浏览器 DevTools 或带登录 Cookie 的 curl）
# 期望：cache-control: private, no-store
# 公开页仍可 public, max-age=300...

# 头像上传后应返回 /uploads/avatars/... 且可直接访问 200
```

主链路验证：

1. 做一次脸扫 + 报告；查同 session 的 `AIUsageLog` 只有 1 次 vision + 1 次 text。
2. 性别不一致免费重试：不应再 409，也不应重复调用视觉模型。
3. `session/status` 不应长期停在 analyzing。
4. 管理员仪表盘周趋势不再全 0。
5. `/api/account/addresses` 若仍 401，看 `pm2 logs skin-advisor | grep account-bff` 的 `No official access token` 诊断。

## 6. 管理端运行配置（Admin SSO / Cron / TOTP）

### 6.1 管理端 SSO 必配项

子站管理端只接受 NIHPLOD 主站管理员 SSO。以下变量必须同时存在于根目录 `.env.production` 和 `.next/standalone/.env.production`（postbuild 会自动同步副本）：

```env
ADMIN_SSO_ENABLED="true"
ADMIN_SSO_AUTHORIZE_URL="https://nihplod.cn/admin/sso/authorize"
ADMIN_SSO_TOKEN_URL="http://127.0.0.1:3000/api/admin/sso/token"
ADMIN_SSO_STATUS_URL="http://127.0.0.1:3000/api/admin/sso/status"
ADMIN_SSO_CLIENT_ID="skin-advisor-admin"
ADMIN_SSO_CLIENT_SECRET="与主站 ADVISOR_ADMIN_SSO_CLIENT_SECRET 同值"
ADMIN_SSO_REDIRECT_URI="https://smart.nihplod.cn/api/admin/auth/sso/callback"
ADMIN_SSO_SECRET="与主站 ADVISOR_ADMIN_SSO_SECRET 同值"
ADMIN_SSO_SESSION_TTL_MINUTES="540"

ADMIN_LOCAL_LOGIN_ENABLED="false"
ADMIN_BREAK_GLASS_ENABLED="false"
ADMIN_BREAK_GLASS_USERNAME="emergency-admin"
BREAK_GLASS_TOTP_SECRET="..."
```

验证：

```bash
curl -sS -o /dev/null -D - https://smart.nihplod.cn/api/admin/auth/sso/start | grep -iE '^(HTTP/|location:)'
# 期望 307，Location 指向 https://nihplod.cn/admin/sso/authorize
```

> 本地开发时，工作区根目录 `.env.production` 不应直接用于生产；生产以服务器上的 `.env.production` 为准。`NEXT_PUBLIC_*` 变量改动后必须重新 build。

### 6.2 Cron：数据清理与管理员状态同步

```bash
sudo crontab -e
# Node 24 路径为 /usr/local/bin/node
*/30 * * * * cd /var/www/Skin-Advisor && /usr/local/bin/node scripts/run-cron.js /api/cron/data-cleanup >> /var/log/myskin-cron.log 2>&1
*/5  * * * * cd /var/www/Skin-Advisor && /usr/local/bin/node scripts/run-cron.js /api/cron/admin-sso-sync >> /var/log/skin-advisor-sso-sync.log 2>&1
```

验证：

```bash
sudo tail -n 20 /var/log/skin-advisor-sso-sync.log
# 期望 {"success":true,"checked":N,"updated":0,"revoked":0}

sudo -u postgres psql -d skin_advisor_db -c \
'SELECT username, active, "lastSyncedAt" FROM "AdminUser" WHERE "authSource" = '\''sso'\'' ORDER BY "createdAt";'
```

> `admin-sso-sync` 每 5 分钟把主站管理员状态/角色/tokenVersion 同步到子站；主站禁用或降权后，子站会话会在同步周期内被撤销。不要只依赖登录时的权限刷新。

### 6.3 TOTP 强制策略

```env
# 到期后，未开启主站 TOTP 的 SSO 管理员将被拒绝登录
# off/false/0 可关闭强制
ADMIN_TOTP_ENFORCEMENT_DATE="2027-11-01T00:00:00+08:00"
```

上线前确认所有 SSO 管理员已在主站开启 TOTP：

```sql
SELECT username, role, "mainTotpEnabled", active
FROM "AdminUser"
WHERE "authSource" = 'sso'
ORDER BY "createdAt";
```

### 6.4 Break-glass 应急流程（默认关闭）

1. 事故时在 `.env.production` 设 `ADMIN_BREAK_GLASS_ENABLED="true"`；
2. 同步到 `.next/standalone/.env.production`（重新 build 或手动 `cp`）；
3. `pm2 restart skin-advisor`；
4. 通过 `/admin/emergency-login` 使用应急账号 + TOTP 登录；
5. 处理完毕立即改回 `false` 并重启。

## 7. 已知风险/回滚

- baseline 是生产库写操作：执行前必须有 `pg_dump`；异常时恢复备份并回滚代码。
- PM2 配置已改为直接运行 Node（`script: .next/standalone/server.js`、heap 2G、max memory 3G）；回滚旧配置需同时恢复 `ecosystem.config.js` 并 `pm2 delete/start`。
- 缓存头修复后，公开页仍可 CDN 缓存；个人页强制 `private, no-store`。
- 泄露的登录态已通过退出登录撤销；access JWT 最长 30 分钟自然过期。
