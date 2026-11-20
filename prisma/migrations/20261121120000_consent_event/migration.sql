-- 只追加的同意事件台账（不建 User 外键，注销后保留最小化证据）
CREATE TYPE "ConsentEventAction" AS ENUM ('GRANTED', 'REVOKED');
CREATE TYPE "ConsentEventDocument" AS ENUM ('PRIVACY', 'TERMS', 'FACE', 'HEALTH', 'AI');

CREATE TABLE "ConsentEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "subjectType" TEXT NOT NULL DEFAULT 'USER',
    "subjectHash" TEXT NOT NULL,
    "project" TEXT NOT NULL DEFAULT 'SKIN',
    "document" "ConsentEventDocument" NOT NULL,
    "version" TEXT NOT NULL,
    "action" "ConsentEventAction" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'skin',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "evidence" JSONB,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsentEvent_userId_occurredAt_idx"
    ON "ConsentEvent"("userId", "occurredAt");

CREATE INDEX "ConsentEvent_subjectHash_occurredAt_idx"
    ON "ConsentEvent"("subjectHash", "occurredAt");

CREATE INDEX "ConsentEvent_document_occurredAt_idx"
    ON "ConsentEvent"("document", "occurredAt");

CREATE INDEX "ConsentEvent_retentionUntil_idx"
    ON "ConsentEvent"("retentionUntil");

CREATE INDEX "ConsentEvent_occurredAt_idx"
    ON "ConsentEvent"("occurredAt");
