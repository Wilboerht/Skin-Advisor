#!/usr/bin/env node
/**
 * 管理员 SSO 影子账号迁移脚本
 *
 * 用法：
 *   node scripts/admin-sso-migrate.mjs                 # dry-run，只打印计划
 *   node scripts/admin-sso-migrate.mjs --apply         # 回填匹配账号
 *   node scripts/admin-sso-migrate.mjs --delete-unmatched --confirm
 *   node scripts/admin-sso-migrate.mjs --delete-unmatched --confirm --force
 *
 * 说明：
 * - 主站库默认由 DATABASE_URL 的库名替换为 nihplod_db 推导；
 *   可用 MAIN_DATABASE_URL 覆盖。
 * - 回填不会清空 password，保留 1-2 周回滚能力。
 * - 删除未匹配账号前会写一条 AdminAuditLog，历史审计保留（adminId 由 FK 置空）。
 */
import "dotenv/config";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import pg from "pg";

// 生产脚本只读取 .env.production；已有环境变量优先（dotenv 不覆盖）
dotenv.config({ path: ".env.production" });

const { Client } = pg;

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const DELETE_UNMATCHED = args.has("--delete-unmatched");
const CONFIRM = args.has("--confirm");
const FORCE = args.has("--force");

function deriveMainDatabaseUrl(subUrl) {
  if (process.env.MAIN_DATABASE_URL) return process.env.MAIN_DATABASE_URL;
  const parsed = new URL(subUrl);
  parsed.pathname = "/nihplod_db";
  return parsed.toString();
}

function asStringArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string");
      }
    } catch {
      return value
        .replace(/^{|}$/g, "")
        .split(",")
        .map((item) => item.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
  }
  return [];
}

function resolveAdvisorRole(mainAdmin) {
  if (mainAdmin.role === "owner") return "super_admin";
  const raw = asStringArray(mainAdmin.permissions);
  // 与主站 resolveAdminPermissions 对齐：普通条目为追加授权，!权限点 为撤销
  const granted = new Set(raw.filter((item) => !item.startsWith("!")));
  for (const item of raw) {
    if (item.startsWith("!")) granted.delete(item.slice(1));
  }
  if (granted.has("advisor:admin")) return "super_admin";
  if (granted.has("advisor:access")) return "admin";
  return null;
}

function maskEmail(email) {
  if (!email) return "(none)";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

async function main() {
  const subUrl = process.env.DATABASE_URL;
  if (!subUrl) {
    console.error("❌ DATABASE_URL 未配置");
    process.exit(1);
  }
  const mainUrl = deriveMainDatabaseUrl(subUrl);

  const subClient = new Client({ connectionString: subUrl });
  const mainClient = new Client({ connectionString: mainUrl });

  try {
    await subClient.connect();
    await mainClient.connect();

    const mainResult = await mainClient.query(`
      SELECT id, lower(email) AS email, name, role, permissions, status,
             "deletedAt", "totpEnabled", "tokenVersion"
      FROM "Admin"
      WHERE "deletedAt" IS NULL
    `);
    const mainByEmail = new Map(
      mainResult.rows
        .filter((row) => row.email)
        .map((row) => [row.email.toLowerCase(), row])
    );

    const subResult = await subClient.query(`
      SELECT id, username, email, role, active, "externalAdminId",
             "authSource", "lastLoginAt"
      FROM "AdminUser"
      ORDER BY "createdAt" ASC
    `);

    const matched = [];
    const unmatched = [];
    const alreadyLinked = [];

    for (const row of subResult.rows) {
      // break-glass 是本地应急账号，不属于 SSO 迁移/清理范围
      if (row.authSource === "break_glass") {
        console.log(`🛡️  跳过 break-glass 账号: ${row.username}`);
        continue;
      }
      if (row.externalAdminId) {
        alreadyLinked.push(row);
        continue;
      }
      const email = row.email ? row.email.toLowerCase() : null;
      const mainAdmin = email ? mainByEmail.get(email) : null;
      if (!mainAdmin) {
        unmatched.push(row);
        continue;
      }

      const advisorRole = resolveAdvisorRole(mainAdmin);
      matched.push({
        sub: row,
        main: mainAdmin,
        advisorRole,
        active: Boolean(advisorRole) && mainAdmin.status === "ACTIVE",
      });
    }

    console.log("==========================================");
    console.log(" 管理员 SSO 迁移计划");
    console.log("==========================================");
    console.log(`模式: ${APPLY ? "APPLY" : "DRY-RUN"}`);
    console.log(`子站账号: ${subResult.rows.length}`);
    console.log(`主站有效管理员: ${mainResult.rows.length}`);
    console.log("");

    for (const item of matched) {
      console.log(
        `✅ ${item.sub.username} <${maskEmail(item.sub.email)}> -> 主站 ${item.main.role}/${item.main.id} ` +
          `=> ${item.advisorRole ?? "无权限"}${item.active ? "" : "（停用）"}`
      );
    }
    for (const row of alreadyLinked) {
      console.log(`ℹ️  已绑定: ${row.username} -> ${row.externalAdminId}`);
    }
    for (const row of unmatched) {
      const recent =
        row.lastLoginAt &&
        Date.now() - new Date(row.lastLoginAt).getTime() < 30 * 24 * 60 * 60 * 1000;
      console.log(
        `⚠️  未匹配: ${row.username} <${maskEmail(row.email)}> role=${row.role} ` +
          `active=${row.active} lastLogin=${row.lastLoginAt ?? "never"}` +
          `${recent ? "（近 30 天有登录）" : ""}`
      );
    }

    if (!APPLY && !DELETE_UNMATCHED) {
      console.log("\n当前为 dry-run。确认后加 --apply 回填；删除未匹配账号加 --delete-unmatched --confirm。");
      return;
    }

    if (APPLY) {
      console.log("\n开始回填匹配账号（保留原 password）...");
      for (const item of matched) {
        await subClient.query(
          `UPDATE "AdminUser"
           SET "externalAdminId" = $1,
               "externalRole" = $2,
               "externalTokenVersion" = $3,
               "mainTotpEnabled" = $4,
               "authSource" = 'sso',
               "role" = $5,
               "active" = $6,
               "lastSyncedAt" = NULL,
               "updatedAt" = NOW()
           WHERE id = $7`,
          [
            item.main.id,
            item.main.role,
            item.main.tokenVersion ?? 0,
            Boolean(item.main.totpEnabled),
            item.advisorRole ?? item.sub.role,
            item.active,
            item.sub.id,
          ]
        );
        console.log(`   已更新 ${item.sub.username}`);
      }
    }

    if (DELETE_UNMATCHED) {
      if (!CONFIRM) {
        console.error("\n❌ 删除未匹配账号需要 --confirm");
        process.exitCode = 1;
        return;
      }
      console.log("\n开始删除未匹配测试账号...");
      for (const row of unmatched) {
        const recent =
          row.lastLoginAt &&
          Date.now() - new Date(row.lastLoginAt).getTime() < 30 * 24 * 60 * 60 * 1000;
        if (recent && !FORCE) {
          console.log(
            `   ⚠️  跳过 ${row.username}：近 30 天有登录，如确认是测试账号请加 --force`
          );
          continue;
        }

        await subClient.query("BEGIN");
        try {
          await subClient.query(
            `INSERT INTO "AdminAuditLog"
               (id, "adminId", action, resource, "resourceId", details, ip, "userAgent")
             VALUES ($1, NULL, 'delete_admin_user', 'AdminUser', $2, $3::jsonb, 'migration', 'admin-sso-migrate')`,
            [
              randomUUID(),
              row.id,
              JSON.stringify({
                email: row.email,
                username: row.username,
                role: row.role,
                reason: "unmatched_test_account",
              }),
            ]
          );
          await subClient.query(`DELETE FROM "AdminUser" WHERE id = $1`, [row.id]);
          await subClient.query("COMMIT");
          console.log(`   已删除 ${row.username} <${maskEmail(row.email)}>`);
        } catch (error) {
          await subClient.query("ROLLBACK");
          throw error;
        }
      }
    }

    console.log("\n完成。");
  } finally {
    await subClient.end().catch(() => {});
    await mainClient.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("❌ 迁移失败:", error.message);
  process.exit(1);
});
