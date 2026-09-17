-- 可选：后台用户搜索的 pg_trgm 子串索引（手工执行，不纳入 Prisma 迁移）
--
-- 背景：admin 用户搜索使用 ILIKE '%kw%'，普通 btree 索引失效；安装 pg_trgm 后
-- 由 GIN 索引加速任意子串匹配。Prisma schema 不支持 trgm 索引，故单独维护，
-- 由 DBA/运维在数据库属主权限下执行。
--
-- 执行方式：
--   1. CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- 需数据库属主权限（阿里云 RDS 可用高权限账号）
--   2. psql -f prisma/optional-trgm-indexes.sql
--
-- 验证（应出现 Bitmap Index Scan on User_email_trgm_idx）：
--   EXPLAIN ANALYZE SELECT * FROM "User" WHERE "email" ILIKE '%foo%';

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "User_name_trgm_idx" ON "User" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_email_trgm_idx" ON "User" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_phoneNumber_trgm_idx" ON "User" USING gin ("phoneNumber" gin_trgm_ops);
