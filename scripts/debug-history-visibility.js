// 只读排查脚本：护肤档案测肤记录不可见问题
require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const client = await pool.connect();
    try {
        console.log("=== AdvisorSession 汇总 ===");
        const summary = await client.query(`
            SELECT COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE "userId" IS NULL)::int AS guest,
                   COUNT(*) FILTER (WHERE "archivedAt" IS NOT NULL)::int AS archived,
                   COUNT(*) FILTER (WHERE "completedAt" IS NULL)::int AS incomplete,
                   COUNT(*) FILTER (WHERE "userId" IS NOT NULL AND "completedAt" IS NOT NULL AND "archivedAt" IS NULL)::int AS visible
            FROM "AdvisorSession"`);
        console.table(summary.rows);

        console.log("=== 每个 userId 的可见记录数（可见 = 已绑定用户 + 已完成 + 未归档）===");
        const perUser = await client.query(`
            SELECT LEFT("userId", 16) AS uid_prefix,
                   COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE "completedAt" IS NOT NULL)::int AS completed,
                   COUNT(*) FILTER (WHERE "archivedAt" IS NOT NULL)::int AS archived,
                   MIN("completedAt") AS first_done, MAX("completedAt") AS last_done
            FROM "AdvisorSession"
            WHERE "userId" IS NOT NULL
            GROUP BY "userId" ORDER BY total DESC LIMIT 10`);
        console.table(perUser.rows);

        console.log("=== 用户表（id 前缀 / 手机号掩码 / 创建时间）===");
        const users = await client.query(`
            SELECT LEFT(id, 16) AS uid_prefix,
                   CASE WHEN "phoneNumber" IS NOT NULL THEN LEFT("phoneNumber", 3) || '****' ELSE NULL END AS phone_mask,
                   role, "createdAt"
            FROM "User" ORDER BY "createdAt" DESC LIMIT 20`);
        console.table(users.rows);

        console.log("=== 游客会话（userId IS NULL）完成度 ===");
        const guest = await client.query(`
            SELECT COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE "completedAt" IS NOT NULL)::int AS completed,
                   COUNT(*) FILTER (WHERE ip IS NOT NULL)::int AS with_ip,
                   MAX("completedAt") AS last_done
            FROM "AdvisorSession" WHERE "userId" IS NULL`);
        console.table(guest.rows);

        console.log("=== 归档记录时间分布 ===");
        const arch = await client.query(`
            SELECT LEFT("userId", 16) AS uid_prefix, COUNT(*)::int AS cnt,
                   MIN("archivedAt") AS first_arch, MAX("archivedAt") AS last_arch
            FROM "AdvisorSession" WHERE "archivedAt" IS NOT NULL
            GROUP BY "userId" ORDER BY cnt DESC LIMIT 10`);
        console.table(arch.rows);
    } finally {
        client.release();
        await pool.end();
    }
})().catch((e) => { console.error(e); process.exit(1); });
