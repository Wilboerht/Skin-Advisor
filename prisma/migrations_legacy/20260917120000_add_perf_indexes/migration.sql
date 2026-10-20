-- 性能索引补齐 + 死索引清理
--
-- 1) 历史列表/趋势：AdvisorSession 按 userId + 排除归档 + completedAt 倒序
-- 2) 懒认领：未归属会话（userId IS NULL）按 ip + completedAt 扫描
-- 3) AI 预算检查：AIUsageLog 按 userId + createdAt 窗口 + success
-- 4) 删除 Product.suitableSkinTypes/benefits 的 GIN 索引（全站无 JSON 包含查询，仅写放大）
--
-- 说明：pg_trgm 子串搜索索引不在 Prisma 迁移内维护（Prisma schema 不支持 trgm，
-- 放进来会被 migrate dev 判定为 drift 并生成删除迁移）。需要时手工执行
-- prisma/optional-trgm-indexes.sql。

-- ===== 组合索引 =====
CREATE INDEX IF NOT EXISTS "AdvisorSession_userId_archivedAt_completedAt_idx"
  ON "AdvisorSession" ("userId", "archivedAt", "completedAt");

CREATE INDEX IF NOT EXISTS "AdvisorSession_ip_completedAt_idx"
  ON "AdvisorSession" ("ip", "completedAt");

CREATE INDEX IF NOT EXISTS "AIUsageLog_userId_createdAt_success_idx"
  ON "AIUsageLog" ("userId", "createdAt", "success");

-- ===== 死索引清理 =====
DROP INDEX IF EXISTS "Product_suitableSkinTypes_idx";
DROP INDEX IF EXISTS "Product_benefits_idx";
