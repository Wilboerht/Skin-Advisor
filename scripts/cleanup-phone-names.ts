/**
 * 一次性数据清洗：抹除历史脏昵称（昵称被手机号覆盖）
 *
 * 背景：sso-auth.ts upsertLocalUser 曾在缺少昵称时用手机号兜底写 User.name，
 * 且 getSessionUser 等高频调用不携带 profile（nickname），导致用户已设置的
 * 昵称被反复覆盖成手机号（含 138****1234 掩码格式）。源头已修复（仅在有
 * 昵称时更新 name），本脚本清洗存量脏数据：name 为掩码手机号或 11 位手机号
 * 格式的记录一律置空——用户下次登录/资料回源会用主站昵称重新写入。
 *
 * 使用方法（不会自动运行；需在项目根目录执行）：
 *   npx tsx scripts/cleanup-phone-names.ts             # 实际执行
 *   npx tsx scripts/cleanup-phone-names.ts --dry-run   # 仅预览不修改
 */

// 脚本不经 Next.js 启动，需手动加载环境变量（与 scripts/cleanup-masked-phones.ts
// 同一约定：优先 .env.production，已存在的进程环境变量不覆盖）。
// 注意：必须先配好 env 再导入 prisma 客户端，因此这里用动态 import。
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

for (const name of [".env.production", ".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), name);
    if (fs.existsSync(p)) {
        dotenv.config({ path: p, override: false });
    }
}

// 中国大陆手机号（可带 +86/86 前缀）
const MOBILE_RE = /^(?:\+?86)?1[3-9]\d{9}$/;

/** 判断昵称是否是手机号脏数据（掩码格式或完整手机号） */
function isPhoneLikeName(name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (trimmed.includes("*")) return true; // 掩码手机号 138****1234
    return MOBILE_RE.test(trimmed);
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");

    // prisma 客户端初始化时读取 DATABASE_URL，必须在 dotenv 加载后动态导入
    const { default: prisma } = await import("../src/lib/prisma");
    try {
        console.log("开始清洗脏昵称（name 为手机号）...\n");

        const candidates = await prisma.user.findMany({
            where: { name: { not: null } },
            select: { id: true, name: true, phoneNumber: true },
        });

        const affected = candidates.filter((u) => u.name !== null && isPhoneLikeName(u.name));

        if (affected.length === 0) {
            console.log("没有需要清洗的记录");
            return;
        }

        console.log(`发现 ${affected.length} 条脏昵称记录：`);
        for (const u of affected) {
            console.log(`  - user ${u.id}: name=${u.name} phoneNumber=${u.phoneNumber ?? "null"}`);
        }

        if (dryRun) {
            console.log("\n--dry-run：未做任何修改");
            return;
        }

        const result = await prisma.user.updateMany({
            where: { id: { in: affected.map((u) => u.id) } },
            data: { name: null },
        });

        console.log(`\n完成，已置空 ${result.count} 条记录的 name`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
