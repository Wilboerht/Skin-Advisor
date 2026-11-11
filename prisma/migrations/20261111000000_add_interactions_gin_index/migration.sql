-- 管理端漏斗按 interactions 类型做 JSONB containment 查询。
-- GIN jsonb_path_ops 比默认 jsonb_ops 更小更快，适合 @> 查询。
CREATE INDEX IF NOT EXISTS "AdvisorSession_interactions_idx"
ON "AdvisorSession" USING GIN ("interactions" jsonb_path_ops);
