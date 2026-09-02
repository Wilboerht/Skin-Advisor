-- Add membershipLevel column to User table (SSO membership_level: REGULAR / ADVANCED; NULL 视为普通会员)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membershipLevel" TEXT;
