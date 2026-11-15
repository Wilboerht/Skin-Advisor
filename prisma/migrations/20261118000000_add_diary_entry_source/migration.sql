-- 区分手动打卡与测肤自动记录：统计、连续天数、积分只认 manual
ALTER TABLE "DiaryEntry" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

-- 旧数据回填：自动记录以「在线测肤」备注前缀识别（与 diary-utils 兼容口径一致）
UPDATE "DiaryEntry"
SET "source" = 'auto'
WHERE "note" LIKE '在线测肤%';

CREATE INDEX "DiaryEntry_userId_source_date_idx"
ON "DiaryEntry"("userId", "source", "date");
