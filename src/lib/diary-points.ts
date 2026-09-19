/**
 * 打卡积分发放客户端
 *
 * 规则（产品口径）：手动打卡按连续天数发放积分——第 1 天 +1、第 2 天 +2、
 * 第 3 天起 +3；连续中断后重新从 +1 算起。连续天数的判定口径与护肤档案
 * 里程碑的"连续打卡"一致（测肤自动条目也计入连续天数）。
 *
 * 官网是积分权威账本：本模块只负责把"谁、哪天、连续第几天、多少分"
 * 上报给官网内部 API；幂等由官网 PointLedger 的 userId+reference 唯一约束
 * 兜底（reference = checkin:{userId}:{date}），删除后重新打卡、并发重复
 * 提交、网络重试均不会重复发放。
 *
 * 可靠性：
 * - 每次尝试都重新签名（nonce 一次性；复用旧签名会被官网判为重放）；
 * - 瞬时失败（网络/超时/5xx/429）自动重试，尝试间短退避；
 * - 仍失败不阻断打卡本身（返回 null 由调用方静默降级）；
 * - backfillRecentCheckinPoints 提供"漏发自愈"：后续任意一次打卡时
 *   对最近窗口内的手动打卡日按幂等键重发（账本幂等，重复发放无副作用）。
 */
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { checkinPointsForStreak, isAutoDiaryEntry, streakEndingAt } from "@/lib/diary-utils";

const GRANT_PATH = "/api/v1/internal/points/grant";
/** 单次尝试超时：打卡请求会 await 本调用，控制在用户可接受范围内 */
const GRANT_TIMEOUT_MS = 2500;
/** 总尝试次数（含首次）；瞬时失败自动重试 */
const GRANT_MAX_ATTEMPTS = 2;
const GRANT_RETRY_DELAY_MS = 400;
/** 漏发自愈回看窗口（天）：覆盖"官网瞬断导致当天漏发"的典型场景 */
const BACKFILL_WINDOW_DAYS = 7;

let warnedMissingKey = false;

export interface CheckinPointsGrantResult {
  /** 实际到账积分（重复发放/失败为 0） */
  granted: number;
  streak: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 为用户某日的手动打卡发放积分。
 * @returns 发放结果；官网不可达/签名配置缺失/最终失败时返回 null
 */
export async function grantCheckinPoints(params: {
  userId: string;
  /** 打卡日历日 YYYY-MM-DD（客户端本地日历日） */
  dateStr: string;
  /** 当日为连续第几天（含当日） */
  streak: number;
  /** 应发积分（min(streak, 3)，由调用方按规则计算） */
  points: number;
}): Promise<CheckinPointsGrantResult | null> {
  const { userId, dateStr, streak, points } = params;
  if (points <= 0) return null;

  const bodyText = JSON.stringify({
    userId,
    points,
    reference: `checkin:${userId}:${dateStr}`,
    // note 会展示在官网会员中心积分明细（类型列已含"打卡奖励"，此处只写连续天数）
    note: `连续第 ${streak} 天`,
  });

  const officialApiUrl = (process.env.OFFICIAL_API_URL || "https://nihplod.cn").replace(/\/+$/, "");

  for (let attempt = 1; attempt <= GRANT_MAX_ATTEMPTS; attempt++) {
    // 每次尝试重新签名：nonce 一次性，复用旧签名会被官网判为重放攻击
    const signed = await createSignedInternalApiHeaders("advisor", "POST", GRANT_PATH, bodyText);
    if (!signed) {
      if (!warnedMissingKey) {
        warnedMissingKey = true;
        logger.warn(
          "[DiaryPoints] 未配置 INTERNAL_API_KEYS（project=advisor），打卡积分发放已跳过（后续不再重复提示）"
        );
      }
      return null;
    }

    try {
      const res = await fetch(`${officialApiUrl}${GRANT_PATH}`, {
        method: "POST",
        headers: signed.headers,
        body: bodyText,
        signal: AbortSignal.timeout(GRANT_TIMEOUT_MS),
      });

      if (!res.ok) {
        // 5xx/429 视为瞬时失败可重试；其余 4xx 重试无意义
        const retryable = res.status >= 500 || res.status === 429;
        logger.warn("[DiaryPoints] 打卡积分发放失败", {
          userId,
          dateStr,
          status: res.status,
          attempt,
          retryable,
        });
        if (retryable && attempt < GRANT_MAX_ATTEMPTS) {
          await delay(GRANT_RETRY_DELAY_MS);
          continue;
        }
        return null;
      }

      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { granted?: number; duplicated?: boolean };
      } | null;
      if (!data?.success) {
        logger.warn("[DiaryPoints] 打卡积分发放响应异常", { userId, dateStr, attempt });
        if (attempt < GRANT_MAX_ATTEMPTS) {
          await delay(GRANT_RETRY_DELAY_MS);
          continue;
        }
        return null;
      }

      // duplicated=true 表示该日已发过（重复提交/删后重打），granted 为 0
      return { granted: data.data?.granted ?? 0, streak };
    } catch (error) {
      logger.warn("[DiaryPoints] 打卡积分发放异常", {
        userId,
        dateStr,
        attempt,
        error: String(error),
      });
      if (attempt < GRANT_MAX_ATTEMPTS) {
        await delay(GRANT_RETRY_DELAY_MS);
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * 漏发自愈（尽力而为，调用方 fire-and-forget）：
 * 对最近 BACKFILL_WINDOW_DAYS 天内所有"手动打卡"日按幂等键重发一次积分。
 *
 * 背景：官网瞬断导致某日发放失败后，当天不会自动补；本函数在用户后续任意一次
 * 打卡/编辑时补偿。账本 userId+reference 幂等，重复发放无副作用；
 * 自动条目（测肤生成）不发放，与打卡入口口径一致。
 *
 * @param skipDateStr 当前请求刚主动发放过的日期（避免同一次请求内重复调用）
 */
export async function backfillRecentCheckinPoints(userId: string, skipDateStr: string): Promise<void> {
  // 时间窗按时间戳比较（日期存 UTC 零点，放宽 1 天兼容客户端时区）
  const since = new Date(Date.now() - (BACKFILL_WINDOW_DAYS + 1) * 86_400_000);
  const [recent, all] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { userId, date: { gte: since } },
      select: { date: true, note: true },
    }),
    prisma.diaryEntry.findMany({ where: { userId }, select: { date: true } }),
  ]);

  const manualDates = recent
    .filter((row) => !isAutoDiaryEntry(row))
    .map((row) => row.date)
    .filter((d) => d.toISOString().slice(0, 10) !== skipDateStr);
  if (manualDates.length === 0) return;

  const allDates = all.map((row) => row.date);
  for (const date of manualDates) {
    const streak = streakEndingAt(allDates, date);
    const points = checkinPointsForStreak(streak);
    if (points <= 0) continue;
    await grantCheckinPoints({
      userId,
      dateStr: date.toISOString().slice(0, 10),
      streak,
      points,
    });
  }
}
