-- 子站管理员改为主站 Admin SSO 影子账号
-- SSO 账号不再存储密码；仅 break-glass / 过渡期本地登录保留 password
ALTER TABLE "AdminUser" ALTER COLUMN "password" DROP NOT NULL;

ALTER TABLE "AdminUser" ADD COLUMN "externalAdminId" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "externalRole" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "externalTokenVersion" INTEGER;
ALTER TABLE "AdminUser" ADD COLUMN "mainTotpEnabled" BOOLEAN;
ALTER TABLE "AdminUser" ADD COLUMN "authSource" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "AdminUser" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "AdminUser_externalAdminId_key" ON "AdminUser"("externalAdminId");
