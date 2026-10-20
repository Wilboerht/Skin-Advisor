-- AlterTable: AdvisorSession 增加冷热分层归档时间戳
ALTER TABLE "AdvisorSession" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex: 归档任务过滤/历史接口排除归档行
CREATE INDEX "AdvisorSession_archivedAt_idx" ON "AdvisorSession"("archivedAt");
