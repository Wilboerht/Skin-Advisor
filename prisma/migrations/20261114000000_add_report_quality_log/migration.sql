-- ReportV3 Phase 6: 报告生成质量指标
CREATE TABLE "ReportQualityLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "narrativeSource" TEXT NOT NULL,
    "fallbackReason" TEXT,
    "promptVersion" TEXT,
    "model" TEXT,
    "diagnosisFindingCount" INTEGER NOT NULL DEFAULT 0,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "coverageScored" INTEGER NOT NULL DEFAULT 0,
    "coverageTotal" INTEGER NOT NULL DEFAULT 0,
    "lowConfidenceCount" INTEGER NOT NULL DEFAULT 0,
    "notVisibleCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportQualityLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportQualityLog_sessionId_key" ON "ReportQualityLog"("sessionId");
CREATE INDEX "ReportQualityLog_createdAt_idx" ON "ReportQualityLog"("createdAt");
CREATE INDEX "ReportQualityLog_narrativeSource_createdAt_idx" ON "ReportQualityLog"("narrativeSource", "createdAt");
