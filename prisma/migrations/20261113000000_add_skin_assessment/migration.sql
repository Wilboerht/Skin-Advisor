-- ReportV3 Phase 3: 评分汇总表（趋势/百分位/后台统计）
CREATE TABLE "SkinAssessment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "overallScore" INTEGER,
    "skinAge" INTEGER,
    "skinType" TEXT,
    "skinTypeLabel" TEXT,
    "persona" TEXT,
    "coverageScored" INTEGER NOT NULL DEFAULT 0,
    "coverageTotal" INTEGER NOT NULL DEFAULT 0,
    "lowConfidence" JSONB,
    "notVisible" JSONB,
    "dimensions" JSONB NOT NULL,
    "zones" JSONB,
    "conditions" JSONB,
    "findings" JSONB,
    "promptVersion" TEXT,
    "engineVersion" TEXT,
    "model" TEXT,
    "dataSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkinAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SkinAssessment_sessionId_key" ON "SkinAssessment"("sessionId");
CREATE INDEX "SkinAssessment_userId_completedAt_idx" ON "SkinAssessment"("userId", "completedAt");
CREATE INDEX "SkinAssessment_completedAt_idx" ON "SkinAssessment"("completedAt");

ALTER TABLE "SkinAssessment"
    ADD CONSTRAINT "SkinAssessment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SkinAssessment"
    ADD CONSTRAINT "SkinAssessment_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AdvisorSession"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;
