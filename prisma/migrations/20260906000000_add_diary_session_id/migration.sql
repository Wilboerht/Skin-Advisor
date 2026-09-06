-- 护肤日记条目增加测肤会话关联，用于从"在线测肤"自动条目跳转对应报告
ALTER TABLE "DiaryEntry" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
