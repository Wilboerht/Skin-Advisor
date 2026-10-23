/**
 * 内部接口：复测提醒候选名单（供主站官网 cron 调用）
 *
 * GET /api/internal/retest-due
 *   → { users: [{ userId, lastTestAt }] }
 *
 * 口径：以「最后一次已完成的测肤」为锚点，返回 lastTestAt 落在
 * 「今天-30 天（CST 自然日）00:00 ～ 次日 00:00」窗口内的用户
 * （30 天 ≈ 皮肤代谢周期，行业惯例的复测节奏）。
 * 官网 cron 每日调用一次（cronExpressions 每天 10 点），每个用户每个周期
 * 恰好命中一天 → 天然去重，无需发送台账；未订阅（43101）由微信侧过滤。
 *
 * 边界：单次最多返回 MAX_DUE_USERS 条，超出部分记日志（当前规模不会触达；
 * 若触达说明需要改为批量分片发送）。
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorizeInternalRequest } from "@/lib/internal-api";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { UserRole } from "@/lib/permissions";
import { logger } from "@/lib/logger";

/** 复测提醒锚点：距最后一次测肤完成满 N 天（30 ≈ 皮肤代谢周期） */
const RETEST_DAYS = 30;
const MAX_DUE_USERS = 500;
/** 中国标准时间偏移（无夏令时） */
const CST_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export async function GET(request: NextRequest) {
    const auth = await authorizeInternalRequest(request, { legacy: "bearer-advisor-secret" });
    if (!auth.ok) {
        return NextResponse.json({ error: "Unauthorized" }, { status: auth.status ?? 401 });
    }

    // 系统级接口（非按用户调用）：仅保留宽松的 IP 上限，防密钥泄漏后的批量遍历
    const ip = getClientIP(request);
    const ipLimit = await rateLimit(`internal-retest-due-ip-${ip}`, "default", {
        maxRequests: 30,
        windowMs: 60 * 1000,
    });
    if (!ipLimit.success) {
        return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }

    try {
        // CST 自然日窗口 [今天-30 天 00:00, 今天-29 天 00:00)，UTC 毫秒表示
        const nowCst = new Date(Date.now() + CST_OFFSET_MS);
        const todayStartUtc =
            Date.UTC(nowCst.getUTCFullYear(), nowCst.getUTCMonth(), nowCst.getUTCDate()) - CST_OFFSET_MS;
        const start = new Date(todayStartUtc - RETEST_DAYS * DAY_MS);
        const end = new Date(start.getTime() + DAY_MS);

        const grouped = await prisma.advisorSession.groupBy({
            by: ["userId"],
            where: { completedAt: { not: null } },
            _max: { completedAt: true },
        });

        const matched: Array<{ userId: string; lastTestAt: Date }> = [];
        for (const g of grouped) {
            const at = g._max.completedAt;
            // userId 可空（游客会话）：游客无账号不可提醒，直接跳过
            if (g.userId && at && at >= start && at < end) {
                matched.push({ userId: g.userId, lastTestAt: at });
            }
        }

        // 子站账号被禁用的用户不发复测提醒（主站 cron 会直接给小程序推送）
        let activeMatched = matched;
        if (matched.length > 0) {
            const activeUsers = await prisma.user.findMany({
                where: {
                    id: { in: matched.map((g) => g.userId) },
                    role: { not: UserRole.DISABLED },
                },
                select: { id: true },
            });
            const activeIds = new Set(activeUsers.map((u) => u.id));
            activeMatched = matched.filter((g) => activeIds.has(g.userId));
        }

        if (activeMatched.length > MAX_DUE_USERS) {
            logger.warn("[internal/retest-due] 命中上限，超出部分本周期不再提醒", {
                matched: activeMatched.length,
                max: MAX_DUE_USERS,
            });
        }

        const users = activeMatched.slice(0, MAX_DUE_USERS).map((g) => ({
            userId: g.userId,
            lastTestAt: g.lastTestAt.toISOString(),
        }));

        return NextResponse.json({ users });
    } catch (error) {
        logger.error("[internal/retest-due] 查询失败", { error: String(error) });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
