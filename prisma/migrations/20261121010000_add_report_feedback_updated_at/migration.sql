-- "最近用户反馈"按最近一次改判/补充原因排序，而不是首次提交时间。
ALTER TABLE "ReportFeedback" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "ReportFeedback" SET "updatedAt" = "createdAt";
ALTER TABLE "ReportFeedback" ALTER COLUMN "updatedAt" SET NOT NULL;
