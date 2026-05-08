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
