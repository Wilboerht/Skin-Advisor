-- Add active field to AdminUser for account disable without deletion
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
