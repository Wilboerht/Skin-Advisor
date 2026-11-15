CREATE TABLE "MergeOperation" (
  "operationId" TEXT PRIMARY KEY,
  "sourceUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "MergeOperation_sourceUserId_idx" ON "MergeOperation"("sourceUserId");
CREATE INDEX "MergeOperation_targetUserId_idx" ON "MergeOperation"("targetUserId");
CREATE INDEX "MergeOperation_createdAt_idx" ON "MergeOperation"("createdAt");

CREATE TABLE "ProductSyncSession" (
  "id" TEXT PRIMARY KEY,
  "syncId" TEXT NOT NULL UNIQUE,
  "batchCount" INTEGER NOT NULL,
  "totalProducts" INTEGER NOT NULL,
  "seenSourceIds" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ProductSyncSession_status_expiresAt_idx" ON "ProductSyncSession"("status", "expiresAt");

CREATE TABLE "ProductSyncBatch" (
  "id" TEXT PRIMARY KEY,
  "syncId" TEXT NOT NULL,
  "batchIndex" INTEGER NOT NULL,
  "products" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductSyncBatch_session_fkey" FOREIGN KEY ("syncId") REFERENCES "ProductSyncSession"("syncId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProductSyncBatch_syncId_batchIndex_key" ON "ProductSyncBatch"("syncId", "batchIndex");


