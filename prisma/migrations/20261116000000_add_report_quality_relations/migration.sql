-- 质量日志与会话/用户建立级联关系，避免注销/删除会话后残留可关联到用户的分析指标。
DELETE FROM "ReportQualityLog" q
WHERE NOT EXISTS (
    SELECT 1 FROM "AdvisorSession" s WHERE s."sessionId" = q."sessionId"
);

DELETE FROM "ReportQualityLog" q
WHERE q."userId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "User" u WHERE u."id" = q."userId"
  );

ALTER TABLE "ReportQualityLog"
    ADD CONSTRAINT "ReportQualityLog_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AdvisorSession"("sessionId")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportQualityLog"
    ADD CONSTRAINT "ReportQualityLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ReportQualityLog_userId_createdAt_idx"
    ON "ReportQualityLog"("userId", "createdAt");
