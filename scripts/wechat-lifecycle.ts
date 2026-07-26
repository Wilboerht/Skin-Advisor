/**
 * 微信生命周期消息链脚本
 *
 * 通过官网内部 API 向完成测肤的用户发送分阶段消息：
 * - Day 1: 欢迎消息 + 肤质报告摘要链接
 * - Day 3: 推荐产品护肤小贴士（含购买链接）
 * - Day 7: 邀请评价推荐产品
 * - 季节变换: 换季护肤提醒 + 产品推荐
 * - 活动上线: 新活动推送通知
 *
 * 调度方式: 配合 cron 每日执行
 *   - Vercel Cron Jobs: 在 vercel.json 中配置 cron 触发
 *   - 或通过 scripts/run-cron.js 手动执行
 *
 * 使用: npx tsx scripts/wechat-lifecycle.ts [--dry-run] [--stage=day1|day3|day7|season|campaign]
 */

import { PrismaClient } from "@prisma/client";
import { getSeason, getSeasonLabel, type Season } from "../src/lib/weather-context";

const prisma = new PrismaClient();

// ==================== 配置 ====================

const OFFICIAL_API_URL = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://advisor.nihplod.cn";

const DRY_RUN = process.argv.includes("--dry-run");
const STAGE_ARG = process.argv.find((a) => a.startsWith("--stage="));
const TARGET_STAGE = STAGE_ARG ? STAGE_ARG.split("=")[1] : "all";

// ==================== 签名辅助 ====================

async function createSignature(path: string, body: string): Promise<{ headers: HeadersInit } | null> {
    if (!INTERNAL_API_KEY) {
        console.warn("[Lifecycle] INTERNAL_API_KEY not set, cannot sign requests");
        return null;
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(INTERNAL_API_KEY);
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const payload = encoder.encode(`POST\n${path}\n${body}`);
    const signature = await crypto.subtle.sign("HMAC", key, payload);
    const sigHex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return {
        headers: {
            "Content-Type": "application/json",
            "X-Internal-Signature": sigHex,
            "X-Internal-Client": "lifecycle-script",
        },
    };
}

// ==================== 内部 API 调用 ====================

async function sendWechatMessage(userId: string, templateData: Record<string, unknown>): Promise<boolean> {
    const path = "/api/v1/internal/wechat/send-template";
    const body = JSON.stringify({ userId, ...templateData });

    const signed = await createSignature(path, body);
    if (!signed) return false;

    try {
        const res = await fetch(`${OFFICIAL_API_URL}${path}`, {
            method: "POST",
            headers: signed.headers,
            body,
        });
        if (res.ok) {
            console.log(`  ✓ 消息发送成功: userId=${userId}`);
            return true;
        }
        console.warn(`  ✗ 消息发送失败: userId=${userId}, status=${res.status}`);
        return false;
    } catch (err) {
        console.error(`  ✗ 消息发送异常: userId=${userId}`, err);
        return false;
    }
}

// ==================== Day 1 - 欢迎 + 报告摘要 ====================

async function sendDay1Messages() {
    console.log("\n📅 Day 1: 欢迎消息 + 肤质报告摘要");

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    oneDayAgo.setHours(0, 0, 0, 0);
    const oneDayAgoEnd = new Date(oneDayAgo);
    oneDayAgoEnd.setHours(23, 59, 59, 999);

    // 查找昨天完成测肤的登录用户
    const sessions = await prisma.advisorSession.findMany({
        where: {
            completedAt: { gte: oneDayAgo, lte: oneDayAgoEnd },
            userId: { not: null },
        },
        select: {
            userId: true,
            id: true,
            analysisResult: true,
            user: { select: { name: true } },
        },
        take: 500,
    });

    console.log(`  找到 ${sessions.length} 个目标用户`);

    for (const session of sessions) {
        if (!session.userId) continue;

        const reportUrl = `${BASE_URL}/reports/${session.id}`;
        const result = session.analysisResult as Record<string, unknown> | null;
        const score = result && typeof result === "object" && "overallScore" in result
            ? (result as { overallScore: number }).overallScore
            : undefined;

        if (DRY_RUN) {
            console.log(`  [DRY RUN] 发送欢迎消息: userId=${session.userId}, score=${score}`);
            continue;
        }

        await sendWechatMessage(session.userId, {
            templateType: "welcome",
            userName: session.user?.name || "用户",
            reportUrl,
            score: score || "未知",
        });
    }
}

// ==================== Day 3 - 护肤小贴士 ====================

async function sendDay3Messages() {
    console.log("\n📅 Day 3: 推荐产品护肤小贴士");

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);
    const threeDaysAgoEnd = new Date(threeDaysAgo);
    threeDaysAgoEnd.setHours(23, 59, 59, 999);

    const sessions = await prisma.advisorSession.findMany({
        where: {
            completedAt: { gte: threeDaysAgo, lte: threeDaysAgoEnd },
            userId: { not: null },
        },
        select: {
            userId: true,
            id: true,
            analysisResult: true,
            user: { select: { name: true } },
        },
        take: 500,
    });

    console.log(`  找到 ${sessions.length} 个目标用户`);

    for (const session of sessions) {
        if (!session.userId) continue;

        const result = session.analysisResult as Record<string, unknown> | null;
        const products = result && typeof result === "object" && "products" in result
            ? (result as { products: Array<{ name: string; affiliateLinks?: Record<string, string> }> }).products
            : [];
        const firstProduct = products?.[0];

        if (DRY_RUN) {
            console.log(`  [DRY RUN] 发送护肤贴士: userId=${session.userId}, product=${firstProduct?.name || "无"}`);
            continue;
        }

        await sendWechatMessage(session.userId, {
            templateType: "skincare_tip",
            userName: session.user?.name || "用户",
            productName: firstProduct?.name || "推荐产品",
            productUrl: firstProduct?.affiliateLinks?.xiaohongshu || "",
        });
    }
}

// ==================== Day 7 - 邀请评价 ====================

async function sendDay7Messages() {
    console.log("\n📅 Day 7: 邀请评价推荐产品");

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const sevenDaysAgoEnd = new Date(sevenDaysAgo);
    sevenDaysAgoEnd.setHours(23, 59, 59, 999);

    const sessions = await prisma.advisorSession.findMany({
        where: {
            completedAt: { gte: sevenDaysAgo, lte: sevenDaysAgoEnd },
            userId: { not: null },
        },
        select: {
            userId: true,
            id: true,
            user: { select: { name: true } },
        },
        take: 500,
    });

    console.log(`  找到 ${sessions.length} 个目标用户`);

    for (const session of sessions) {
        if (!session.userId) continue;

        const feedbackUrl = `${BASE_URL}/reports/${session.id}`;

        if (DRY_RUN) {
            console.log(`  [DRY RUN] 发送评价邀请: userId=${session.userId}`);
            continue;
        }

        await sendWechatMessage(session.userId, {
            templateType: "review_invitation",
            userName: session.user?.name || "用户",
            feedbackUrl,
        });
    }
}

// ==================== 季节变换提醒 ====================

const SEASON_CHANGE_MONTHS: Record<Season, number[]> = {
    spring: [3],         // 3月初发送春季护肤提醒
    early_summer: [5],    // 5月初发送初夏护肤提醒
    midsummer: [7],       // 7月初发送盛夏护肤提醒
    autumn: [9],          // 9月初发送秋季护肤提醒
    winter: [11],         // 11月初发送冬季护肤提醒
};

async function sendSeasonChangeMessages() {
    const currentMonth = new Date().getMonth() + 1;
    const currentSeason = getSeason(currentMonth);
    const seasonLabel = getSeasonLabel(currentSeason);

    // 只在季节变换月发送（该月第一天）
    const today = new Date().getDate();
    const changeMonths = SEASON_CHANGE_MONTHS[currentSeason] || [];
    if (!changeMonths.includes(currentMonth) || today > 3) {
        console.log(`\n📅 季节提醒: 非发送窗口 (当前: ${currentMonth}月${today}日, ${seasonLabel})`);
        return;
    }

    console.log(`\n📅 季节变换提醒: ${seasonLabel}`);

    // 查找近30天活跃的登录用户（有完成测肤记录）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await prisma.advisorSession.findMany({
        where: {
            completedAt: { gte: thirtyDaysAgo },
            userId: { not: null },
        },
        select: { userId: true, user: { select: { name: true } } },
        distinct: ["userId"],
        take: 500,
    });

    console.log(`  找到 ${activeUsers.length} 个活跃用户`);

    for (const record of activeUsers) {
        if (!record.userId) continue;

        if (DRY_RUN) {
            console.log(`  [DRY RUN] 发送${seasonLabel}护肤提醒: userId=${record.userId}`);
            continue;
        }

        await sendWechatMessage(record.userId, {
            templateType: "season_change",
            userName: record.user?.name || "用户",
            season: seasonLabel,
            recommendUrl: `${BASE_URL}/?ref=season_${currentSeason}`,
        });
    }
}

// ==================== 活动上线推送 ====================

async function sendCampaignNotifications() {
    console.log("\n📅 活动上线推送");

    // 查找今天开始的活动（startDate 在今天）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const newCampaigns = await prisma.campaign.findMany({
        where: {
            status: "active",
            startDate: { gte: today, lte: todayEnd },
        },
        take: 10,
    });

    if (newCampaigns.length === 0) {
        console.log("  无今日上线的活动");
        return;
    }

    console.log(`  找到 ${newCampaigns.length} 个今日上线活动`);

    // 查找近30天活跃用户
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await prisma.advisorSession.findMany({
        where: {
            completedAt: { gte: thirtyDaysAgo },
            userId: { not: null },
        },
        select: { userId: true, user: { select: { name: true } } },
        distinct: ["userId"],
        take: 500,
    });

    console.log(`  找到 ${activeUsers.length} 个活跃用户`);

    for (const campaign of newCampaigns) {
        for (const record of activeUsers) {
            if (!record.userId) continue;

            if (DRY_RUN) {
                console.log(`  [DRY RUN] 发送活动通知: userId=${record.userId}, campaign=${campaign.title}`);
                continue;
            }

            await sendWechatMessage(record.userId, {
                templateType: "campaign",
                userName: record.user?.name || "用户",
                campaignTitle: campaign.title,
                campaignUrl: `${BASE_URL}/gift?campaign=${campaign.id}`,
            });
        }
    }
}

// ==================== 主入口 ====================

async function main() {
    console.log("=== 微信生命周期消息链 ===");
    console.log(`模式: ${DRY_RUN ? "DRY RUN (预览)" : "正式执行"}`);
    console.log(`阶段: ${TARGET_STAGE}`);
    console.log(`API: ${OFFICIAL_API_URL}`);

    if (!INTERNAL_API_KEY) {
        console.warn("⚠️ INTERNAL_API_KEY 未设置，请求将无法签名");
    }

    try {
        if (TARGET_STAGE === "all" || TARGET_STAGE === "day1") {
            await sendDay1Messages();
        }
        if (TARGET_STAGE === "all" || TARGET_STAGE === "day3") {
            await sendDay3Messages();
        }
        if (TARGET_STAGE === "all" || TARGET_STAGE === "day7") {
            await sendDay7Messages();
        }
        if (TARGET_STAGE === "all" || TARGET_STAGE === "season") {
            await sendSeasonChangeMessages();
        }
        if (TARGET_STAGE === "all" || TARGET_STAGE === "campaign") {
            await sendCampaignNotifications();
        }

        console.log("\n✅ 生命周期消息链执行完成");
    } catch (error) {
        console.error("\n❌ 执行失败:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
