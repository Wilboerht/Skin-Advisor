CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipHash" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsentRecord_userId_scope_version_key" ON "ConsentRecord"("userId", "scope", "version");
CREATE INDEX "ConsentRecord_userId_scope_idx" ON "ConsentRecord"("userId", "scope");
CREATE INDEX "ConsentRecord_version_idx" ON "ConsentRecord"("version");

ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
