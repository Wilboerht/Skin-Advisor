-- DropIndex
DROP INDEX IF EXISTS "User_wechatOpenId_key";

-- DropIndex
DROP INDEX IF EXISTS "User_wechatUnionId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "wechatOpenId",
DROP COLUMN IF EXISTS "wechatUnionId";
