-- AlterTable
-- 主站资料性别（userinfo gender claim），问卷默认值用：male / female / NULL（未设置）
ALTER TABLE "User" ADD COLUMN     "gender" TEXT;
