-- 清理活动抽奖"名额上限"功能移除后遗留的孤儿列（代码已无引用）。
-- 若目标库本无此列（如由 db push 之外方式管理的库），跳过而非报错。
ALTER TABLE "Campaign" DROP COLUMN IF EXISTS "maxEntries";
