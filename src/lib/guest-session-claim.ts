/**
 * 游客测肤会话懒认领
 *
 * 背景：游客测肤的认领唯一入口是结果页的 session/claim，登录态不稳定
 * 时期 claim 静默失败会留下 userId=NULL 的孤儿记录，导致护肤档案
 * 显示"无测肤记录"。此处沿用 claim 路由的归属规则（IP 哈希匹配，
 * 无 IP 的历史遗留记录不动），用户打开档案时自动修复。
 *
 * 调用方：
 * - 子站公共路由 /api/advisor/history（客户端真实 IP）
 * - 子站内部接口（archive / test-history / skin-trends）：主站官网用户中心
 *   打开护肤档案时经 HMAC 内部通道传入 clientIp（服务器间调用本身代表不了
 *   用户真实 IP，必须由官网 BFF 显式传递）。
 */
import prisma from "@/lib/prisma";
import { hashIP } from "@/lib/privacy";
import { upsertAutoDiaryEntry } from "@/lib/diary";
import { logger } from "@/lib/logger";

/**
 * 补建日记的日期口径：客户端未携带本地日历日（dateStr/clientDate）时，
 * 回退为"完成时间的北京时间日历日"（与 src/lib/time.ts 的全站 Asia/Shanghai 口径一致，
 * 不依赖服务器时区；UTC+8 用户与 analyze 主路径的 clientDate 结果一致）。
 * 局限：服务端无法获知用户真实时区，非 UTC+8 用户跨日边界可能有 ±1 天偏差。
 * 与 session/claim 路由的 dateStr 回退为同一实现，两处需保持同步。
 */
function diaryDateStrFallback(completedAt: Date): string {
    const shifted = new Date(completedAt.getTime() + 8 * 60 * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
}

export async function lazyClaimGuestSessions(userId: string, ip: string): Promise<void> {
    try {
        const ipHash = hashIP(ip);
        const claimable = await prisma.advisorSession.findMany({
            where: { userId: null, ip: ipHash, completedAt: { not: null } },
            select: { sessionId: true, completedAt: true, analysisResult: true }
        });
        if (claimable.length === 0) return;

        const claimed = await prisma.advisorSession.updateMany({
            where: {
                userId: null,
                ip: ipHash,
                completedAt: { not: null },
                sessionId: { in: claimable.map((s) => s.sessionId) }
            },
            data: { userId }
        });
        if (claimed.count === 0) return;
        logger.info(`[history] Lazy-claimed ${claimed.count} guest session(s) for user ${userId}`);

        // 补建自动日记条目（与 claim 路由一致；best-effort，不阻塞响应）
        for (const session of claimable) {
            try {
                const result = session.analysisResult as Record<string, unknown> | null;
                if (!session.completedAt || !result) continue;
                const face = (result.faceAnalysis ?? null) as { overallScore?: unknown } | null | undefined;
                if (typeof face?.overallScore !== "number") continue;
                const skinProfile = (result.skinProfile ?? null) as { typeLabel?: unknown } | null | undefined;
                const skinAnalysis = (result.skinAnalysis ?? null) as { typeLabel?: unknown } | null | undefined;
                const skinTypeLabel =
                    typeof skinProfile?.typeLabel === "string" ? skinProfile.typeLabel
                    : typeof skinAnalysis?.typeLabel === "string" ? skinAnalysis.typeLabel
                    : undefined;
                upsertAutoDiaryEntry({
                    userId,
                    dateStr: diaryDateStrFallback(session.completedAt),
                    score: face.overallScore,
                    skinTypeLabel,
                    sessionId: session.sessionId
                }).catch((err) => logger.error("[history] 懒认领补建日记失败:", err));
            } catch (e) {
                logger.error("[history] 懒认领补建日记查询失败:", e);
            }
        }
    } catch (e) {
        // 认领失败不影响主查询
        logger.error("[history] Lazy claim failed:", e);
    }
}

/** IP 字面量（IPv4/IPv6），长度上限防御异常输入 */
const CLIENT_IP_RE = /^[\d.:a-fA-F]{1,64}$/;

/**
 * 内部接口专用：clientIp 来自 HMAC 签名通道，仅接受 IP 字面量；
 * 非法/缺失时静默跳过（不阻断读取）。
 */
export async function claimGuestSessionsFromClientIp(
    userId: string,
    clientIp: string | null
): Promise<void> {
    if (!clientIp || !CLIENT_IP_RE.test(clientIp)) return;
    await lazyClaimGuestSessions(userId, clientIp);
}
