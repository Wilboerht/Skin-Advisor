-- 测肤同意事件补充法律文本内容哈希（仅 privacy/terms 有值）
ALTER TABLE "ConsentEvent" ADD COLUMN "contentHash" TEXT;
