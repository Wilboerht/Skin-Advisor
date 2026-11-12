-- ReportV3 Phase 1: 报告纠错反馈
CREATE TABLE "ReportFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportFeedback_userId_sessionId_targetType_targetKey_key"
    ON "ReportFeedback"("userId", "sessionId", "targetType", "targetKey");

CREATE INDEX "ReportFeedback_sessionId_idx" ON "ReportFeedback"("sessionId");
CREATE INDEX "ReportFeedback_userId_createdAt_idx" ON "ReportFeedback"("userId", "createdAt");

ALTER TABLE "ReportFeedback"
    ADD CONSTRAINT "ReportFeedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportFeedback"
    ADD CONSTRAINT "ReportFeedback_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AdvisorSession"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;
