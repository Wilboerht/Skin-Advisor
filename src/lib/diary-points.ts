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
 * 失败语义：积分是打卡的附加激励，官网不可达/超时不阻断打卡本身，
 * 返回 null 由调用方静默降级（仅记日志）。
 */
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import { logger } from "@/lib/logger";

const GRANT_PATH = "/api/v1/internal/points/grant";
const GRANT_TIMEOUT_MS = 5000;

export interface CheckinPointsGrantResult {
  /** 实际到账积分（重复发放/失败为 0） */
  granted: number;
  streak: number;
}

/**
 * 为用户某日的手动打卡发放积分。
 * @returns 发放结果；官网不可达/签名配置缺失/非 2xx 时返回 null
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

  try {
    const signed = await createSignedInternalApiHeaders("advisor", "POST", GRANT_PATH, bodyText);
    if (!signed) {
      logger.warn("[DiaryPoints] 未配置内部 API 密钥，跳过打卡积分发放");
      return null;
    }

    const officialApiUrl = (process.env.OFFICIAL_API_URL || "https://nihplod.cn").replace(/\/+$/, "");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GRANT_TIMEOUT_MS);

    const res = await fetch(`${officialApiUrl}${GRANT_PATH}`, {
      method: "POST",
      headers: signed.headers,
      body: bodyText,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      logger.warn("[DiaryPoints] 打卡积分发放失败", { userId, dateStr, status: res.status });
      return null;
    }

    const data = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: { granted?: number; duplicated?: boolean };
    } | null;
    if (!data?.success) {
      logger.warn("[DiaryPoints] 打卡积分发放响应异常", { userId, dateStr });
      return null;
    }

    // duplicated=true 表示该日已发过（重复提交/删后重打），granted 为 0
    return { granted: data.data?.granted ?? 0, streak };
  } catch (error) {
    logger.warn("[DiaryPoints] 打卡积分发放异常", { userId, dateStr, error: String(error) });
    return null;
  }
}
