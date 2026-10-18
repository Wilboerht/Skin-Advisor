#!/usr/bin/env node
/**
 * 创建/重置子站 break-glass 应急超管
 *
 * 用法：
 *   node scripts/setup-break-glass.mjs --confirm
 *   node scripts/setup-break-glass.mjs --confirm --force
 *
 * 密码来源：
 *   - BREAK_GLASS_PASSWORD 环境变量；未设置时自动生成并只打印一次
 * TOTP：
 *   - BREAK_GLASS_TOTP_SECRET 环境变量；未设置时自动生成并打印 otpauth URL
 *
 * 说明：
 * - 该账号不参与正常 SSO；仅 ADMIN_BREAK_GLASS_ENABLED=true 时可通过
 *   /admin/emergency-login 登录。
 * - 密码/TOTP secret 请存入密码管理器，不要提交到 git。
 */
import "dotenv/config";
import dotenv from "dotenv";
import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

// 生产脚本只读取 .env.production；已有环境变量优先
dotenv.config({ path: ".env.production" });

const { Client } = pg;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generateTotpSecret(bytes = 20) {
  const buffer = randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function buildTotpUri(secret, account) {
  const label = encodeURIComponent(`NIHPLOD:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer: "NIHPLOD",
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("❌ 请加 --confirm 确认创建/重置 break-glass 账号");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL 未配置");
    process.exit(1);
  }

  const username =
    getArg("--username") ||
    process.env.ADMIN_BREAK_GLASS_USERNAME ||
    "emergency-admin";
  const password =
    process.env.BREAK_GLASS_PASSWORD ||
    randomBytes(24).toString("base64url");
  const totpSecret =
    process.env.BREAK_GLASS_TOTP_SECRET || generateTotpSecret();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const existing = await client.query(
      `SELECT id, "authSource" FROM "AdminUser" WHERE username = $1`,
      [username]
    );

    const passwordHash = await bcrypt.hash(password, 12);

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.authSource !== "break_glass" && !process.argv.includes("--force")) {
        console.error(
          `❌ 用户名 ${username} 已被 ${row.authSource} 账号占用；如确认覆盖请加 --force`
        );
        process.exit(1);
      }
      await client.query(
        `UPDATE "AdminUser"
         SET password = $1,
             name = 'Emergency Admin',
             email = NULL,
             role = 'super_admin',
             active = TRUE,
             "authSource" = 'break_glass',
             "externalAdminId" = NULL,
             "externalRole" = NULL,
             "externalTokenVersion" = NULL,
             "mainTotpEnabled" = NULL,
             "sessionRevokedAt" = NOW(),
             "updatedAt" = NOW()
         WHERE id = $2`,
        [passwordHash, row.id]
      );
      console.log(`✅ 已重置 break-glass 账号: ${username}`);
    } else {
      await client.query(
        `INSERT INTO "AdminUser"
           (id, username, email, password, name, role, active, "authSource",
            "createdAt", "updatedAt")
         VALUES ($1, $2, NULL, $3, 'Emergency Admin', 'super_admin', TRUE, 'break_glass',
                 NOW(), NOW())`,
        [randomUUID(), username, passwordHash]
      );
      console.log(`✅ 已创建 break-glass 账号: ${username}`);
    }

    console.log("");
    console.log("请立即保存以下信息（只显示一次）：");
    console.log(`  用户名: ${username}`);
    console.log(`  密码:   ${password}`);
    console.log(`  TOTP:   ${totpSecret}`);
    console.log(`  二维码: ${buildTotpUri(totpSecret, username)}`);
    console.log("");
    console.log("并在 /var/www/Skin-Advisor/.env.production 中配置：");
    console.log(`  ADMIN_BREAK_GLASS_ENABLED="false"`);
    console.log(`  ADMIN_BREAK_GLASS_USERNAME="${username}"`);
    console.log(`  BREAK_GLASS_TOTP_SECRET="${totpSecret}"`);
    console.log("");
    console.log("事故时才将 ADMIN_BREAK_GLASS_ENABLED 改为 true，并重启 skin-advisor。");
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("❌ 操作失败:", error.message);
  process.exit(1);
});
