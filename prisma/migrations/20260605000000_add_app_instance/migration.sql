-- Add AppInstance table for multi-instance deployment detection
CREATE TABLE IF NOT EXISTS "AppInstance" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPing" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "AppInstance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppInstance_lastPing_idx" ON "AppInstance"("lastPing");
