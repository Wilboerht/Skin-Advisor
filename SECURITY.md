# 安全加固与部署检查清单

> 本文档用于记录 AI 费用/密钥相关的风险修复与生产部署注意事项。

## 1. 已修复的代码层风险

### 1.1 前端 5xx 自动重试导致重复 AI 扣费
- **文件**：`src/hooks/useAsyncAnalysis.ts`
- **修复**：`fetchWithRetry` 默认不在 5xx 时重试；`/api/advisor/face-analyze` 与 `/api/advisor/analyze` 显式传入 `{ retries: 0 }`。

### 1.2 AI 模型选择无白名单
- **文件**：`src/lib/ai.ts`、`src/lib/ai-vision.ts`
- **修复**：新增 `ALLOWED_AI_PROVIDERS` 与 `ALLOWED_AI_MODELS` 白名单；`getAISettings()` 对数据库配置做运行时校验，非法模型自动回退到默认低成本模型。

### 1.3 缺少全局 AI 预算熔断
- **文件**：`src/lib/ai-budget.ts`（新增）、`src/lib/ai.ts`、`src/lib/ai-vision.ts`、`src/app/api/advisor/analyze/route.ts`、`src/app/api/advisor/face-analyze/route.ts`
- **修复**：
  - 每次 AI 调用持久化到 `AIUsageLog`（模型、token、估算费用、sessionId、userId）。
  - 调用前检查全局日/月 token 与费用预算，超限时直接拒绝（`AI_BUDGET_EXCEEDED`）。
  - 预算环境变量：
    - `AI_DAILY_TOKEN_BUDGET`
    - `AI_DAILY_COST_BUDGET_CNY`
    - `AI_MONTHLY_TOKEN_BUDGET`
    - `AI_MONTHLY_COST_BUDGET_CNY`

### 1.4 Docker Compose 硬编码数据库密码
- **文件**：`docker-compose.yml`、`.env.example`
- **修复**：密码改为环境变量 `${POSTGRES_PASSWORD}`，示例文件给出 `CHANGE_ME_...` 占位提示。

### 1.5 废弃微信模块泄露 AppSecret
- **文件**：`src/lib/wechat.ts`（已删除）
- **修复**：该模块无人引用且将 `appSecret` 放在 URL query 中，已直接删除。

## 2. 生产部署前必须手动完成

### 2.1 替换 `.env.production` 中的占位值
运行以下命令生成强随机 secret：

```bash
openssl rand -base64 32
```

必须替换的变量：
- `JWT_SECRET`
- `ADMIN_SESSION_SECRET`
- `CRON_SECRET`
- `IP_HASH_SALT`
- `ADMIN_SECRET`
- `SETUP_SECRET`
- `INTERNAL_API_SECRET`
- `POSTGRES_PASSWORD`
- `ADMIN_INITIAL_PASSWORD`（首次 setup 后立即移除）

### 2.2 运行生产准备脚本
```bash
node scripts/prepare-production.js && next build
```
脚本会校验上述 secret 不是占位值、PostgreSQL 密码强度、至少配置了一个 AI Key。

### 2.3 数据库结构同步
生产环境使用 PostgreSQL 时执行：
```bash
npx prisma db push
# 或迁移方式：
# npx prisma migrate dev --name add_ai_usage_log
```

### 2.4 密钥存储方式升级（建议）
- 不要长期将生产密钥保存在 `.env.production` 明文文件中。
- 建议使用：阿里云 KMS / Azure Key Vault / AWS Secrets Manager / Docker Secrets / PM2 加密环境变量。

## 3. Git 历史清理（可选但建议）

仓库历史中存在已删除的 `avatar-queue-processor.ts` 及 `WANXIANG_API_KEY` / `VOLC_ACCESSKEY` / `VOLC_SECRETKEY` 相关调试代码。虽然当前工作树已无此文件，但历史提交仍可通过 `git show` 读取。

**如果以下任一条件成立，建议清理 Git 历史：**
1. 历史提交中曾经写入过真实密钥值；
2. 历史调试日志曾打印过密钥片段；
3. 仓库将被公开或分享给第三方。

### 清理步骤

**警告：这会重写 Git 历史，所有协作者都需要重新 clone！**

```bash
# 1. 安装 git-filter-repo（如果没有）
pip install git-filter-repo

# 2. 进入仓库目录
cd skin-advisor-standalone

# 3. 备份仓库
cp -r . ../skin-advisor-standalone-backup

# 4. 删除历史中的敏感文件路径
git filter-repo --path src/lib/avatar-queue-processor.ts --path src/app/api/advisor/avatar/generate/route.ts --invert-paths

# 5. 如果历史中存在真实密钥值，按内容过滤（替换 EXAMPLE 为真实 key 片段）
# git filter-repo --replace-text <(echo 'sk-xxxxxxxxxxxx==>REDACTED')

# 6. 强制推送（谨慎！）
git push origin --force --all
```

执行前请确认：
- 所有分支已同步到本地；
- 已通知所有协作者；
- 已备份完整仓库。

## 4. 持续监控建议

- 在 `.env.production` 中设置预算熔断阈值。
- 定期查询 `AIUsageLog` 表，监控单日/单月 token 与费用。
- 对单用户/单 IP 的用量突增设置告警。
- 如需水平扩容，必须将内存限流器（`src/lib/ratelimit.ts`）替换为 Redis/Upstash 分布式限流。
