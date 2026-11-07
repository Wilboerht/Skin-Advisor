-- Harden refresh token storage and add indexes used by cleanup / retention jobs.

-- 1) Deduplicate refresh token hashes before adding the unique constraint.
--    Same-second issuance used to produce identical JWTs; keep the oldest row.
DELETE FROM "RefreshToken" a
USING "RefreshToken" b
WHERE a."token" = b."token"
  AND (a."createdAt" > b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

DROP INDEX IF EXISTS "RefreshToken_token_idx";
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- 2) Cleanup indexes.
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");
CREATE INDEX "TestRecord_testDate_idx" ON "TestRecord"("testDate");
CREATE INDEX "AdvisorSession_completedAt_expiresAt_idx" ON "AdvisorSession"("completedAt", "expiresAt");
CREATE INDEX "AdvisorSession_userId_createdAt_idx" ON "AdvisorSession"("userId", "createdAt");

-- 3) Redundant single-column indexes covered by composite indexes.
DROP INDEX IF EXISTS "AdvisorSession_userId_idx";
DROP INDEX IF EXISTS "DiaryEntry_userId_idx";
DROP INDEX IF EXISTS "AIUsageLog_userId_idx";

-- 4) TestRecord 预占租约：区分 reserved/consumed，支持精确回滚。
ALTER TABLE "TestRecord" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'reserved';
ALTER TABLE "TestRecord" ADD COLUMN "leaseToken" TEXT;
ALTER TABLE "TestRecord" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
-- 历史记录都是已完成的真实测试，回填为 consumed，避免被孤儿预占清理任务删除
UPDATE "TestRecord" SET "status" = 'consumed' WHERE "testDate" < NOW();
CREATE INDEX "TestRecord_status_testDate_idx" ON "TestRecord"("status", "testDate");

-- 5) 评分百分位 DISTINCT ON 的表达式索引（COALESCE 无法用普通列索引覆盖）。
CREATE INDEX "AdvisorSession_userId_orderedAt_idx"
  ON "AdvisorSession" ("userId", (COALESCE("analysisCompletedAt", "completedAt", "createdAt")) DESC);

-- 6) ProductFeedback -> Product FK (remove unusable orphans first).
DELETE FROM "ProductFeedback" f
WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = f."productId");

ALTER TABLE "ProductFeedback"
  ADD CONSTRAINT "ProductFeedback_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
