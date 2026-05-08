-- AvatarQueue table (idempotent — safe to run even if table already exists)
CREATE TABLE IF NOT EXISTS "AvatarQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nickname" TEXT,
    "characteristics" TEXT,
    "frontPhoto" TEXT,
    "generatedUrl" TEXT,
    "source" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "AvatarQueue_sessionId_key" ON "AvatarQueue"("sessionId");
CREATE INDEX IF NOT EXISTS "AvatarQueue_status_createdAt_idx" ON "AvatarQueue"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AvatarQueue_expiresAt_idx" ON "AvatarQueue"("expiresAt");

-- 添加外键约束（条件性，避免已有数据冲突时失败）
-- 注：如果已有 sessionId 指向不存在的 AdvisorSession，此步骤会失败。
-- 请先确保 AvatarQueue.sessionId 都有效，或手动清理孤立记录后再执行。
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AvatarQueue_sessionId_fkey'
    ) THEN
        ALTER TABLE "AvatarQueue"
        ADD CONSTRAINT "AvatarQueue_sessionId_fkey"
        FOREIGN KEY ("sessionId") REFERENCES "AdvisorSession"("sessionId")
        ON DELETE CASCADE;
    END IF;
END $$;
