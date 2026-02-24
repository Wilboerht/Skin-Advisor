-- =============================================
-- 排行榜性能优化索引 — 在 Supabase SQL Editor 中执行
-- =============================================

-- 1. 基础索引：createdAt（排行榜30天时间范围过滤）
CREATE INDEX IF NOT EXISTS "AdvisorSession_createdAt_idx"
ON "AdvisorSession" ("createdAt");

-- 2. 基础索引：userId（JOIN User 加速）
CREATE INDEX IF NOT EXISTS "AdvisorSession_userId_idx"
ON "AdvisorSession" ("userId");

-- 3. 部分索引：仅索引有分析结果的会话（排行榜核心 WHERE 条件）
CREATE INDEX IF NOT EXISTS "AdvisorSession_leaderboard_idx"
ON "AdvisorSession" ("createdAt" DESC)
WHERE "analysisResult" IS NOT NULL;
