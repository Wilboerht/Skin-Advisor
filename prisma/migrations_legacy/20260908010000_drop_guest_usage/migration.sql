-- 游客测肤下线：GuestUsage 模型整体删除（封禁/计次能力随游客测肤一并下线）。
-- AdvisorSession.fingerprint 一并 drop：前端从不上报（analytics/track 恒为 null），
-- 仅 OSS 上传路径隔离仍用指纹，不依赖该列。

-- AlterTable
ALTER TABLE "AdvisorSession" DROP COLUMN "fingerprint";

-- DropTable
DROP TABLE "GuestUsage";
