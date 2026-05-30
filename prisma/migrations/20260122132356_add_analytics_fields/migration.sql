-- PostgreSQL compatible: add analytics columns to AdvisorSession
ALTER TABLE "AdvisorSession"
    ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "questionnaireStartedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "questionnaireCompletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "faceScanStartedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "faceScanCompletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "analysisStartedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "analysisCompletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "resultViewedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "answers" JSONB,
    ADD COLUMN IF NOT EXISTS "faceScanUsed" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "faceScanSkipped" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "analysisSource" TEXT,
    ADD COLUMN IF NOT EXISTS "analysisResult" JSONB,
    ADD COLUMN IF NOT EXISTS "resultShared" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "shareMethod" TEXT,
    ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
    ADD COLUMN IF NOT EXISTS "ip" TEXT,
    ADD COLUMN IF NOT EXISTS "deviceType" TEXT,
    ADD COLUMN IF NOT EXISTS "browser" TEXT,
    ADD COLUMN IF NOT EXISTS "os" TEXT,
    ADD COLUMN IF NOT EXISTS "province" TEXT,
    ADD COLUMN IF NOT EXISTS "city" TEXT,
    ADD COLUMN IF NOT EXISTS "referrer" TEXT,
    ADD COLUMN IF NOT EXISTS "fingerprint" TEXT,
    ADD COLUMN IF NOT EXISTS "utmSource" TEXT,
    ADD COLUMN IF NOT EXISTS "utmMedium" TEXT,
    ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Ensure unique index on sessionId
CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorSession_sessionId_key" ON "AdvisorSession"("sessionId");
