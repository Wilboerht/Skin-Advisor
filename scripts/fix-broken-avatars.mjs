#!/usr/bin/env node
/**
 * 一次性修复：清理指向已丢失本地文件的头像 URL。
 *
 * 只处理子站本地存储路径（/uploads/... 或 https://smart.nihplod.cn/uploads/...），
 * 官网远程头像（https://nihplod.cn/uploads/...）不动。
 *
 * 默认 dry-run；确认后加 --apply 执行更新。
 *
 * 用法：
 *   node scripts/fix-broken-avatars.mjs
 *   node scripts/fix-broken-avatars.mjs --apply
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env.production") });

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error("DATABASE_URL is not set (.env.production)");
    process.exit(1);
}

const uploadRoot = path.join(ROOT, "public", "uploads");
const localPrefixes = ["/uploads/", "https://smart.nihplod.cn/uploads/"];

function toLocalRelative(url) {
    for (const prefix of localPrefixes) {
        if (url.startsWith(prefix)) return url.slice(prefix.length);
    }
    return null;
}

const { Pool } = pg;
const pool = new Pool({ connectionString: databaseUrl });

try {
    const { rows } = await pool.query(
        'SELECT id, "avatarUrl" FROM "User" WHERE "avatarUrl" IS NOT NULL'
    );
    let checked = 0;
    let missing = 0;
    let remote = 0;
    const broken = [];

    for (const row of rows) {
        const url = row.avatarUrl;
        const relative = toLocalRelative(url);
        if (!relative) {
            remote++;
            continue;
        }
        checked++;
        const filePath = path.resolve(uploadRoot, relative);
        const rel = path.relative(uploadRoot, filePath);
        if (rel.startsWith("..") || path.isAbsolute(rel)) {
            console.warn(`skip out-of-bounds avatar path: ${relative}`);
            continue;
        }
        if (!fs.existsSync(filePath)) {
            missing++;
            broken.push({ id: row.id, relative });
        }
    }

    console.log(JSON.stringify({ total: rows.length, localChecked: checked, remote, missing, apply }, null, 2));
    for (const item of broken) {
        console.log(`missing local avatar: ${item.relative}`);
    }

    if (apply && broken.length > 0) {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            for (const item of broken) {
                await client.query('UPDATE "User" SET "avatarUrl" = NULL WHERE id = $1', [item.id]);
            }
            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
        console.log(`cleared ${broken.length} broken avatar URL(s)`);
    } else if (!apply && broken.length > 0) {
        console.log("dry-run only; re-run with --apply to clear");
    }
} finally {
    await pool.end();
}
