-- SSO 同步主站累计消费金额（元），用于 SILVER 银卡测肤加赠：每满 1000 元 +20 次
ALTER TABLE "User" ADD COLUMN "totalSpent" INTEGER NOT NULL DEFAULT 0;
