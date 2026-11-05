ALTER TABLE "User" ADD COLUMN "lastStatusEventAt" TIMESTAMP(3);

CREATE TABLE "StatusWebhookEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "newStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StatusWebhookEvent_userId_eventAt_idx" ON "StatusWebhookEvent"("userId", "eventAt");
CREATE INDEX "StatusWebhookEvent_createdAt_idx" ON "StatusWebhookEvent"("createdAt");

ALTER TABLE "StatusWebhookEvent" ADD CONSTRAINT "StatusWebhookEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
