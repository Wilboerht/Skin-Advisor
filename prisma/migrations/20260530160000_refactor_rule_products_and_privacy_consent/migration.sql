-- 1. 创建推荐规则与产品的中间表（替代 JSON 数组）
CREATE TABLE IF NOT EXISTS "RecommendationRuleProduct" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "RecommendationRuleProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecommendationRuleProduct_ruleId_productId_key"
    ON "RecommendationRuleProduct"("ruleId", "productId");
CREATE INDEX IF NOT EXISTS "RecommendationRuleProduct_productId_idx"
    ON "RecommendationRuleProduct"("productId");

ALTER TABLE "RecommendationRuleProduct"
    ADD CONSTRAINT "RecommendationRuleProduct_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "RecommendationRule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. 迁移现有 JSON 数据到中间表
INSERT INTO "RecommendationRuleProduct" ("id", "ruleId", "productId")
SELECT gen_random_uuid(), r."id", elem::text
FROM "RecommendationRule" r,
LATERAL jsonb_array_elements_text(r."productIds") AS elem
WHERE r."productIds" IS NOT NULL
  AND jsonb_typeof(r."productIds") = 'array'
ON CONFLICT DO NOTHING;

-- 3. 删除旧的 JSON 列
ALTER TABLE "RecommendationRule" DROP COLUMN IF EXISTS "productIds";

-- 4. 添加缺失索引
CREATE INDEX IF NOT EXISTS "RecommendationRule_active_priority_idx"
    ON "RecommendationRule"("active", "priority");
CREATE INDEX IF NOT EXISTS "WeatherCache_expiresAt_idx"
    ON "WeatherCache"("expiresAt");
CREATE INDEX IF NOT EXISTS "GuestUsage_lastResetDate_idx"
    ON "GuestUsage"("lastResetDate");

-- 5. 添加隐私同意字段
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyConsentVersion" TEXT;
ALTER TABLE "AdvisorSession" ADD COLUMN IF NOT EXISTS "privacyConsentAt" TIMESTAMP(3);
ALTER TABLE "AdvisorSession" ADD COLUMN IF NOT EXISTS "privacyConsentVersion" TEXT;
ALTER TABLE "GuestUsage" ADD COLUMN IF NOT EXISTS "privacyConsentAt" TIMESTAMP(3);
ALTER TABLE "GuestUsage" ADD COLUMN IF NOT EXISTS "privacyConsentVersion" TEXT;
