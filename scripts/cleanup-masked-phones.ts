/**
 * 一次性数据清洗：抹除存量掩码手机号
 *
 * 背景：主站 SSO access token / userinfo 的 phone claim 可能是掩码格式
 * （138****1234）。sso-auth.ts upsertLocalUser 曾把掩码值直接落入
 * User.phoneNumber，之后该值会被当作真实手机号查询主站内部接口
 * （/api/v1/internal/points/balance 的 zod 校验 /^1[3-9]\d{9}$/ 必 400）。
 * 源头已修复（掩码值不再落库），本脚本清洗存量脏数据：含 "*" 的
 * phoneNumber 一律置为 null（不影响登录，手机号会在下次 SSO 登录时
 * 由 userinfo 回源重新写入真实值——若主站仍只给掩码则保持 null）。
 *
 * 使用方法（不会自动运行）：
 *   npx tsx scripts/cleanup-masked-phones.ts
 */

import prisma from "../src/lib/prisma";

async function main() {
    console.log("🧹 开始清洗掩码手机号（phoneNumber 含 *）...\n");

    const affected = await prisma.user.findMany({
        where: { phoneNumber: { contains: "*" } },
        select: { id: true, phoneNumber: true },
    });

    if (affected.length === 0) {
        console.log("✅ 没有需要清洗的记录");
        return;
    }

    console.log(`发现 ${affected.length} 条掩码手机号记录：`);
    for (const u of affected) {
        console.log(`  - user ${u.id}: ${u.phoneNumber}`);
    }

    const result = await prisma.user.updateMany({
        where: { phoneNumber: { contains: "*" } },
        data: { phoneNumber: null },
    });

    console.log(`\n🎉 完成，已置空 ${result.count} 条记录的 phoneNumber`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
