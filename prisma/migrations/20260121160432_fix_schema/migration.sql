-- PostgreSQL compatible: add columns to AdvisorQuestion
ALTER TABLE "AdvisorQuestion"
    ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS "gender" TEXT NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Ensure unique index on fieldName
CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorQuestion_fieldName_key" ON "AdvisorQuestion"("fieldName");
