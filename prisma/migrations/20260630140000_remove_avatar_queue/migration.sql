-- Drop AvatarQueue table and its constraints (idempotent)

-- Drop foreign key constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'AvatarQueue_sessionId_fkey'
    ) THEN
        ALTER TABLE "AvatarQueue" DROP CONSTRAINT "AvatarQueue_sessionId_fkey";
    END IF;
END
$$;

-- Drop indexes if they exist
DROP INDEX IF EXISTS "AvatarQueue_status_createdAt_idx";
DROP INDEX IF EXISTS "AvatarQueue_expiresAt_idx";
DROP INDEX IF EXISTS "AvatarQueue_sessionId_key";

-- Drop the table if it exists
DROP TABLE IF EXISTS "AvatarQueue";
