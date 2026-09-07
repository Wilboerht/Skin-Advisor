/**
 * 一次性回填脚本：把历史游客测肤会话（userId IS NULL）绑定到指定用户。
 *
 * 背景：登录态不稳定时期，结果页 session/claim 静默失败留下孤儿记录，
 * 导致护肤档案显示"无测肤记录"。线上常规修复由 /api/advisor/history 的
 * 懒认领自动完成（同 IP 哈希规则）；本脚本用于手工指定归属的场景
 * （如 IP 已变化、懒认领无法覆盖的历史数据）。
 *
 * 用法：
 *   node scripts/claim-guest-sessions.js <userId 或手机号>            # 预览（dry-run）
 *   node scripts/claim-guest-sessions.js <userId 或手机号> --yes      # 实际执行
 *   node scripts/claim-guest-sessions.js <userId> --all --yes         # 含未完成的会话
 *   node scripts/claim-guest-sessions.js <userId> --session <sessionId> --yes  # 只绑定指定会话
 */
require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const args = process.argv.slice(2);
const userKey = args[0];
const execute = args.includes("--yes");
const includeIncomplete = args.includes("--all");
const onlySession = args.includes("--session") ? args[args.indexOf("--session") + 1] : null;

if (!userKey) {
    console.error("用法: node scripts/claim-guest-sessions.js <userId 或手机号> [--all] [--session <id>] [--yes]");
    process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const client = await pool.connect();
    try {
        const userRes = await client.query(
            `SELECT id, "phoneNumber", name FROM "User" WHERE id = $1 OR "phoneNumber" = $1`,
            [userKey]
        );
        if (userRes.rows.length === 0) {
            console.error(`找不到用户: ${userKey}`);
            process.exit(1);
        }
        const user = userRes.rows[0];
        console.log(`目标用户: id=${user.id} phone=${user.phoneNumber || "-"} name=${user.name || "-"}`);

        const conditions = [`"userId" IS NULL`];
        const params = [];
        if (!includeIncomplete) conditions.push(`"completedAt" IS NOT NULL`);
        if (onlySession) {
            params.push(onlySession);
            conditions.push(`"sessionId" = $${params.length}`);
        }

        const sessions = await client.query(
            `SELECT "sessionId", "completedAt", ip IS NOT NULL AS "hasIp"
             FROM "AdvisorSession" WHERE ${conditions.join(" AND ")}
             ORDER BY "completedAt" DESC NULLS LAST`,
            params
        );

        if (sessions.rows.length === 0) {
            console.log("没有符合条件的游客会话。");
            return;
        }

        console.log(`\n符合条件的游客会话 ${sessions.rows.length} 条：`);
        console.table(sessions.rows.map((s) => ({
            sessionId: s.sessionId.slice(0, 12) + "…",
            completedAt: s.completedAt,
            hasIp: s.hasIp,
        })));

        if (!execute) {
            console.log("（dry-run）加 --yes 参数实际执行绑定。");
            return;
        }

        const updated = await client.query(
            `UPDATE "AdvisorSession" SET "userId" = $1
             WHERE ${conditions.join(" AND ")}`,
            [user.id, ...params]
        );
        console.log(`✅ 已绑定 ${updated.rowCount} 条会话到用户 ${user.id}`);
        console.log("提示：用户打开护肤档案时，history 接口会为带评分的会话自动补建当日日记条目。");
    } finally {
        client.release();
        await pool.end();
    }
})().catch((e) => { console.error(e); process.exit(1); });
