-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdvisorSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "startedAt" DATETIME,
    "questionnaireStartedAt" DATETIME,
    "questionnaireCompletedAt" DATETIME,
    "faceScanStartedAt" DATETIME,
    "faceScanCompletedAt" DATETIME,
    "analysisStartedAt" DATETIME,
    "analysisCompletedAt" DATETIME,
    "resultViewedAt" DATETIME,
    "completedAt" DATETIME,
    "answers" JSONB,
    "faceScanUsed" BOOLEAN NOT NULL DEFAULT false,
    "faceScanSkipped" BOOLEAN NOT NULL DEFAULT false,
    "analysisSource" TEXT,
    "analysisResult" JSONB,
    "resultShared" BOOLEAN NOT NULL DEFAULT false,
    "shareMethod" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "province" TEXT,
    "city" TEXT,
    "referrer" TEXT,
    "fingerprint" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_AdvisorSession" ("analysisResult", "analysisSource", "answers", "completedAt", "createdAt", "faceScanUsed", "id", "sessionId") SELECT "analysisResult", "analysisSource", "answers", "completedAt", "createdAt", "faceScanUsed", "id", "sessionId" FROM "AdvisorSession";
DROP TABLE "AdvisorSession";
ALTER TABLE "new_AdvisorSession" RENAME TO "AdvisorSession";
CREATE UNIQUE INDEX "AdvisorSession_sessionId_key" ON "AdvisorSession"("sessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
