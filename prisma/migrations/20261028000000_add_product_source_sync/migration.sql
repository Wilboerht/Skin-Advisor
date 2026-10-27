-- AlterTable
ALTER TABLE "Product" ADD COLUMN "sourceProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "sourceSyncedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "sourceMissingAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sourceProductId_key" ON "Product"("sourceProductId");
