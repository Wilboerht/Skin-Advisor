-- Remove VIP-related fields and migrate existing VIP roles

-- 1. Drop the VIP expiration column
ALTER TABLE "User" DROP COLUMN IF EXISTS "vipExpiresAt";

-- 2. Convert any remaining VIP users to regular users
UPDATE "User" SET "role" = 'user' WHERE "role" = 'vip';

-- 3. Clear previousRole if it points to the obsolete VIP role
UPDATE "User" SET "previousRole" = NULL WHERE "previousRole" = 'vip';
