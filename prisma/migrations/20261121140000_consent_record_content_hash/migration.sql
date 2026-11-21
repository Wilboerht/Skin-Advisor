-- Bind the current consent record to the published legal content hash.
ALTER TABLE "ConsentRecord" ADD COLUMN "contentHash" TEXT;
