-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdvisorQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'single',
    "options" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL DEFAULT 'general',
    "gender" TEXT NOT NULL DEFAULT 'all',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AdvisorQuestion" ("active", "fieldName", "gender", "id", "options", "order", "question", "type", "updatedAt") SELECT "active", "fieldName", "gender", "id", "options", "order", "question", "type", "updatedAt" FROM "AdvisorQuestion";
DROP TABLE "AdvisorQuestion";
ALTER TABLE "new_AdvisorQuestion" RENAME TO "AdvisorQuestion";
CREATE UNIQUE INDEX "AdvisorQuestion_fieldName_key" ON "AdvisorQuestion"("fieldName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
