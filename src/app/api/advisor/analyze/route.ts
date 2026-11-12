import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { accountDisabledResponse, apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { generateText, getAISettings, type AIProvider } from "@/lib/ai";
import { analysisQueue } from "@/lib/ai-queue";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { parseConsultantReport, sanitizeConsultantReport, type ConsultantReport } from "@/lib/advisor-utils";
import { enforceConsultantReportIngredients, enforceZoneAdviceIngredients } from "@/lib/ingredient-guard";
import { buildConsultantPrompt, CONSULTANT_PROMPT_VERSION, CONSULTANT_SYSTEM_PROMPT, type PersonaRoutineContext } from "@/config/ai-prompts";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import prisma from "@/lib/prisma";
import { withDbRetry } from "@/lib/utils";
import { getSkinTypeLabel, type FaceAnalysisResult } from "@/lib/advisor-utils";
// import { PRODUCTS_CATALOG } from "@/config/products"; // Deprecated, use DB or matchProducts
import { determineSkinType, identifyConcerns } from "@/lib/advisor-utils";
import { AnalyzeRequestSchema } from "@/lib/schemas";
import { upsertAutoDiaryEntry } from "@/lib/diary";
import { recommendProducts, getCandidateProducts, type ProductRecommendation } from "@/lib/recommendations";
import { normalizeImagePath } from "@/types/product";
import { resolveIPLocation } from "@/lib/geoip";
import { getSessionUser, isSubsiteAccountDisabled } from "@/lib/sso-auth";
import { hasConsent } from "@/lib/consent";
import { hashIP } from "@/lib/privacy";
import { matchCharacterIP } from "@/lib/result-utils";
import { isCompletedAnalysisResult } from "@/lib/analysis-result";
import { getEnvContextFromLocation } from "@/lib/weather-context";
import { buildSafetyNotes } from "@/lib/report-safety";
import { buildDiagnosis, narrativeMatchesDiagnosis } from "@/lib/report/diagnosis";
import { buildFallbackConsultantReport } from "@/lib/report/fallback";
import { selectRoutedTextModel } from "@/lib/report/model-routing";
import { compileReportV3 } from "@/lib/report/compile";
import { buildSkinAssessment } from "@/lib/report/assessment";
import type { ReportNarrativeSource } from "@/lib/report/types";

import { checkUsageLimit, markUsageConsumed, renewUsageLease, reserveUsage, rollbackUsage, GUEST_REQUIRE_LOGIN_MESSAGE, type ReserveUsageResult } from "@/lib/usage-limit";
import { aiLogger, logger } from "@/lib/logger";
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import DOMPurify from 'isomorphic-dompurify';
import { parseUserAgent } from "@/lib/user-agent-parser";
import { Prisma } from "@prisma/client";

const WECHAT_TEMPLATE_CIRCUIT_KEY = "official-wechat-template";
const WECHAT_TEMPLATE_MAX_RETRIES = 3;
const WECHAT_TEMPLATE_TIMEOUT_MS = 15000;

// 服务端最长执行时间：匹配 90s 客户端/服务端超时上限
export const maxDuration = 90;

/**
 * 调用官网内部 API v1 发送微信模板消息
 *
 * 官网侧按用户身份双通道发送：公众号模板消息（H5 报告链接）+
 * 测肤小程序订阅消息「报告完成通知」（凭 sessionId 跳小程序报告页）。
 * 增强：HMAC-SHA256 签名鉴权 + 熔断 + 指数退避重试 + 超时 + 结构化日志
 */
async function sendOfficialWechatTemplate(
  userId: string,
  score: number,
  primaryConcern: string,
  reportUrl: string,
  sessionId?: string | null
): Promise<void> {
  if (!circuitBreaker.allowRequest(WECHAT_TEMPLATE_CIRCUIT_KEY)) {
    aiLogger.warn("[WechatTemplate] 熔断器开启，跳过官网模板消息推送");
    return;
  }

  const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
  const path = "/api/v1/internal/wechat/send-template";
  const bodyText = JSON.stringify({
    userId,
    score,
    primaryConcern,
    reportUrl,
    // 测肤小程序订阅消息的跳转参数（旧官网不识别该字段时自动忽略）
    ...(sessionId ? { sessionId } : {}),
  });

  let lastError: unknown;

  for (let attempt = 0; attempt < WECHAT_TEMPLATE_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WECHAT_TEMPLATE_TIMEOUT_MS);

    try {
      // 每次重试都重新签名：官网有 nonce 防重放校验，
      // 复用同一组签名头会导致重试被判 REPLAY_ATTACK（401）
      const signed = await createSignedInternalApiHeaders("advisor", "POST", path, bodyText);
      if (!signed) {
        aiLogger.error("[WechatTemplate] 未配置内部 API 密钥，无法签名请求");
        circuitBreaker.recordFailure(WECHAT_TEMPLATE_CIRCUIT_KEY);
        return;
      }

      const res = await fetch(`${officialApiUrl}${path}`, {
        method: "POST",
        headers: signed.headers,
        body: bodyText,
        signal: controller.signal,
      });

      if (res.ok) {
        circuitBreaker.recordSuccess(WECHAT_TEMPLATE_CIRCUIT_KEY);
        aiLogger.info("[WechatTemplate] 官网模板消息推送成功", { userId, score });
        return;
      }

      const errText = await res.text().catch(() => "");
      aiLogger.warn("[WechatTemplate] 官网模板消息推送失败", {
        userId,
        attempt: attempt + 1,
        status: res.status,
        body: errText.slice(0, 200),
      });
      lastError = new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    } catch (err) {
      lastError = err;
      aiLogger.warn("[WechatTemplate] 官网模板消息调用异常", {
        userId,
        attempt: attempt + 1,
        error: String(err),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (attempt < WECHAT_TEMPLATE_MAX_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt)));
    }
  }

  circuitBreaker.recordFailure(WECHAT_TEMPLATE_CIRCUIT_KEY);
  aiLogger.error("[WechatTemplate] 官网模板消息推送最终失败", {
    userId,
    error: String(lastError),
  });
}

/** 清理推荐理由中的英文词汇，确保对用户友好 */
function sanitizeReason(reason: string): string {
    if (!reason) return reason;
    const replacements: Record<string, string> = {
        average: "一般",
        good: "良好",
        excellent: "优秀",
        fair: "一般",
        poor: "较差",
        mild: "轻度",
        moderate: "中度",
        severe: "重度",
        dry: "干性",
        oily: "油性",
        combination: "混合性",
        sensitive: "敏感性",
        normal: "正常",
        low: "低",
        medium: "中等",
        high: "高",
    };
    let sanitized = reason;
    for (const [en, cn] of Object.entries(replacements)) {
        // 使用非字母前后断言，避免中文语境下 \b 失效；同时防止误切合法产品名中的子串
        const regex = new RegExp(`(?<![a-zA-Z])${en}(?![a-zA-Z])`, "gi");
        sanitized = sanitized.replace(regex, cn);
    }
    return sanitized;
}

/**
 * 检查指定 session 是否已成功完成面部分析（AI 视觉调用已真实扣费/存储）。
 * 用于防止综合 analyze 回滚时退还已被 face-analyze 消耗的额度。
 */
async function hasSuccessfulFaceAnalysis(sessionId: string): Promise<boolean> {
    try {
        const [count, session] = await Promise.all([
            prisma.aIUsageLog.count({
                where: {
                    sessionId,
                    requestType: "vision",
                    success: true,
                },
            }),
            prisma.advisorSession.findUnique({
                where: { sessionId },
                select: { faceScanCompletedAt: true, analysisResult: true },
            }),
        ]);
        if (count > 0) return true;
        // 缓存命中等路径不再写合成 AI 日志：以服务端已持久化的面部结果为准，
        // 否则 analyze 失败时会误退已产生的面部结果额度。
        if (session?.faceScanCompletedAt) return true;
        const persistedFace = (session?.analysisResult as Record<string, unknown> | null)?.faceAnalysis;
        return !!persistedFace;
    } catch (e) {
        logger.warn(`[analyze] Failed to check face analysis usage for ${sessionId}:`, e);
        // 保守认为已消费，避免免费重试漏洞
        return true;
    }
}

/**
 * 检查指定 session 是否已成功产生文本 AI 计费（v2 报告生成）。
 * 用于 AI 失败时判断预占是否可退还：已计费则保留预占（同 session 重试不再扣次）。
 */
async function hasSuccessfulTextAnalysis(sessionId: string): Promise<boolean> {
    try {
        const count = await prisma.aIUsageLog.count({
            where: {
                sessionId,
                requestType: "text",
                success: true,
            },
        });
        return count > 0;
    } catch (e) {
        logger.warn(`[analyze] Failed to check text analysis usage for ${sessionId}:`, e);
        // 保守认为已消费，避免免费重试漏洞
        return true;
    }
}

/**
 * 递归清理 AI 输出中的潜在危险 HTML/JS 内容
 * 使用 DOMPurify 在存储到数据库前进行标准化 XSS 清理
 */
function sanitizeAiOutput(obj: unknown): unknown {
    if (typeof obj === 'string') {
        // DOMPurify 处理 HTML 实体、嵌套标签、事件处理器等边缘情况
        // 比手写正则更全面，且持续维护更新
        return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeAiOutput);
    }
    if (obj !== null && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = sanitizeAiOutput(value);
        }
        return result;
    }
    return obj;
}

/**
 * 免费重试的资格校验：**原会话**必须确实存在"面部识别性别"与"原问卷性别"不一致。
 *
 * 注意比较的是原会话 answers.gender，而不是本次重试的新答案：
 * 用户可能把问卷改成与面部识别一致（或坚持原选择），两种修正都合法。
 * 客户端只在置信度 >0.85 时展示重试弹窗；服务端按同一口径再次校验，
 * 防止用户对任意已完成会话传 freeRetry=true 生成第二份报告/覆盖原报告。
 */
function isValidFreeRetryReason(
    existingResult: Record<string, unknown>,
    originalAnswers: unknown
): boolean {
    const face = existingResult.faceAnalysis as Record<string, unknown> | undefined;
    if (!face) return false;

    const gender = face.gender as unknown;
    let faceGender: string | null = null;
    let confidence = 1;

    if (typeof gender === "string") {
        faceGender = gender;
    } else if (gender && typeof gender === "object") {
        const g = gender as Record<string, unknown>;
        if (typeof g.value === "string") faceGender = g.value;
        if (typeof g.confidence === "number") {
            confidence = g.confidence > 1 ? g.confidence / 100 : g.confidence;
        }
    }

    const answersObj = originalAnswers && typeof originalAnswers === "object"
        ? originalAnswers as Record<string, unknown>
        : null;
    const questionnaireGender = typeof answersObj?.gender === "string" ? answersObj.gender : null;

    return !!faceGender && !!questionnaireGender
        && faceGender !== questionnaireGender
        && confidence > 0.85;
}

/**
 * 清理 analysisStartedAt，避免 session 因中途失败/异常永久卡在 analyzing。
 * 用 updateMany 而非 update：异常发生在 upsert 占位之前时行不存在，
 * 0 行静默跳过，避免 P2025 触发的无意义重试。已完成的会话不动。
 */
async function clearAnalysisStartedAt(sessionId: string): Promise<void> {
    let cleanedUp = false;
    for (let attempt = 0; attempt < 3 && !cleanedUp; attempt++) {
        try {
            // 普通未完成会话
            await prisma.advisorSession.updateMany({
                where: { sessionId, analysisStartedAt: { not: null }, completedAt: null },
                data: { analysisStartedAt: null }
            });

            // 免费重试失败：completedAt 保留旧报告，但 analysisStartedAt 已被改写为
            // 本次重试开始时间（> completedAt）。不清掉会让会话永久卡在"重试进行中"。
            const session = await prisma.advisorSession.findUnique({
                where: { sessionId },
                select: { analysisStartedAt: true, completedAt: true },
            });
            if (
                session?.completedAt
                && session.analysisStartedAt
                && session.analysisStartedAt.getTime() > session.completedAt.getTime()
            ) {
                await prisma.advisorSession.updateMany({
                    where: {
                        sessionId,
                        completedAt: { not: null },
                        analysisStartedAt: session.analysisStartedAt,
                    },
                    data: { analysisStartedAt: null },
                });
            }
            cleanedUp = true;
        } catch (cleanupErr) {
            logger.error(`[analyze] DB cleanup attempt ${attempt + 1}/3 failed:`, cleanupErr);
            if (attempt < 2) {
                await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
            }
        }
    }
    if (!cleanedUp) {
        logger.error(`[analyze] CRITICAL: Failed to cleanup after 3 attempts, session ${sessionId} may be stuck`);
    }
}

/**
 * 报告是否已完成：以 analysisResult 的实际内容为准，而不是 completedAt。
 * 持久化拆成“结果先写、completedAt 后写”后，completedAt 失败也不应让报告消失。
 */
function isReportCompleted(result: unknown): boolean {
    return isCompletedAnalysisResult(result);
}

export async function POST(request: NextRequest) {
    // 创建 AbortController 用于服务端超时和客户端断开取消 AI 请求
    const abortController = new AbortController();
    const requestStartedAt = Date.now();
    // 阶段耗时：用于定位用户主要等待在队列、文本、产品还是落库
    const stageTimings = {
        queueWaitMs: 0,
        textGenerationMs: 0,
        productSelectionMs: 0,
        safetyMs: 0,
        persistMs: 0,
    };
    // 区分“服务端 85s 超时”与“客户端主动断开”：前者可重试/退款，后者不能
    let serverTimedOut = false;
    // 比 maxDuration(90s) 少 5s：保证平台杀进程前有机会走 catch/finally 清理
    const serverTimeout = setTimeout(() => {
        serverTimedOut = true;
        abortController.abort();
    }, 85 * 1000);

    const onClientAbort = () => {
        clearTimeout(serverTimeout);
        abortController.abort();
    };
    request.signal.addEventListener('abort', onClientAbort);

    // 在 try 外声明，供 catch 中清理 session 状态使用。
    // 默认空字符串仅用于避免 TS 2454；真正使用时会在下面重新赋值为有效 sessionId。
    let effectiveSessionId = "";
    // 预占结果也需在 catch 中可见：预占后、AI 调用前的任何异常都应退还额度
    let reservedResult: ReserveUsageResult | null = null;
    // 预占归属用户：回滚时不依赖会话仍然有效，避免留下孤儿 TestRecord
    let reservationUserId: string | undefined;
    // 复用 face-analyze 预占时，等本请求真正 claim 成功后再续租，
    // 避免输掉 claim 的请求把赢家的 rollback token 提前作废
    let needsPriorLeaseRenewal = false;

    try {
        // 0. 拒绝超大请求体（问卷字段有长度上限，正常请求远小于 1MB）
        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > 1_000_000) {
            return apiError(ErrorCode.VALIDATION_ERROR, "请求体过大，请精简后重试", 413);
        }

        // 1. 解析请求体（带 guard，malformed JSON 返回 400 而非 500）
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return apiError(ErrorCode.VALIDATION_ERROR, "无效的请求体，请检查 JSON 格式", 400);
        }

        // 2. 使用 Zod 验证（先验证再扣额度，避免无效请求浪费配额）
        const result = AnalyzeRequestSchema.safeParse(body);
        if (!result.success) {
            logger.error("Analyze validation error:", JSON.stringify(result.error.flatten(), null, 2));
            return apiError(ErrorCode.VALIDATION_ERROR, "请求参数错误", 400, result.error.flatten().fieldErrors);
        }

        // 内部异步任务标记：用于跳过重复的额度预检（worker 仍会原子预占）
        const isInternalReportJob = (body as Record<string, unknown>).__reportJob === true;

        // faceAnalysis 不再从请求体读取：只使用 /face-analyze 服务端持久化的结果
        const { answers, sessionId, nickname, freeRetry, clientDate, privacyConsent, skinState } = result.data;

        // 提取客户端标识（用于会话归属与审计）
        const userAgent = request.headers.get("user-agent");
        const ipHash = hashIP(getClientIP(request));

        // 3. 速率限制 (基础防刷) — 即使免费重试也需要基础限流
        const ip = getClientIP(request);
        const limit = await rateLimit(`advisor-analyze-${ip}`, "comprehensive-analyze", { maxRequests: 20 });

        const geoLocation = resolveIPLocation(ip);
        const envContext = getEnvContextFromLocation(geoLocation?.region, geoLocation?.city);
        const rateLimitHeaders: Record<string, string> = {
            "X-RateLimit-Limit": String(limit.limit),
            "X-RateLimit-Remaining": String(limit.remaining),
            "X-RateLimit-Reset": String(limit.reset)
        };

        if (!limit.success) {
            const response = apiError(ErrorCode.RATE_LIMITED, "请求过于频繁，请稍后再试", 429);
            Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v));
            return response;
        }

        // AI 紧急开关：必须在预占额度前拦截。
        // 之前只在 face-analyze / check-config 里检查，关闭 AI 后最贵的文本分析仍会继续产生费用。
        if (process.env.AI_ENABLED === "false") {
            const response = apiError(ErrorCode.SERVICE_UNAVAILABLE, "AI 服务暂停中，请稍后再试", 503);
            response.headers.set("Retry-After", "300");
            return response;
        }

        // 4. 检查使用限制 (Guest/Member)
        // 提前获取用户会话，避免 freeRetry 路径中重复调用 getSessionUser()
        const user = await getSessionUser(request);
        if (!user && (await isSubsiteAccountDisabled(request))) {
            return accountDisabledResponse();
        }
        if (user && process.env.CONSENT_ENFORCEMENT_ENABLED !== "false" && !(await hasConsent(user.id))) {
            return apiError("CONSENT_REQUIRED", "请先阅读并同意本次测肤所需的授权", 403);
        }
        reservationUserId = user?.id;

        // freeRetry 有效性标记：外部仅做快速预筛（session 存在 + 已完成），
        // ownership 验证与 freeRetryUsed 原子性检查一并移入 DB 行锁事务内，消除 TOCTOU 窗口。
        let isFreeRetryAllowed = false;
        let freeRetryExistingResult: Record<string, unknown> | null = null;
        if (freeRetry && sessionId) {
            // 游客不再享受免费重试：历史 1 小时内的游客会话同样需登录（与主链路同文案同结构）
            if (!user) {
                return NextResponse.json(
                    { success: false, error: { code: ErrorCode.UNAUTHORIZED, message: GUEST_REQUIRE_LOGIN_MESSAGE }, requireLogin: true },
                    { status: 401 }
                );
            }
            // Quick filter: reject obviously invalid requests before acquiring row lock.
            // Ownership verification is deferred to the DB transaction (lockResult) for atomicity.
            const existingSession = await prisma.advisorSession.findUnique({
                where: { sessionId },
                select: { completedAt: true, analysisResult: true, answers: true }
            });
            if (!existingSession || !isReportCompleted(existingSession.analysisResult)) {
                return apiError(ErrorCode.FORBIDDEN, "免费重试无效：请重新进行测试", 403);
            }
            // 缓存已有的 analysisResult，避免事务内重复查询
            freeRetryExistingResult = existingSession.analysisResult as Record<string, unknown>;
            if (freeRetryExistingResult?.freeRetryUsed) {
                // 快速路径：已使用过免费重试，无需进入事务
                return apiError(ErrorCode.RATE_LIMITED, "免费重试已使用，每个会话仅限一次", 429);
            }
            if (!isValidFreeRetryReason(freeRetryExistingResult, existingSession.answers)) {
                return apiError(ErrorCode.FORBIDDEN, "免费重试仅适用于性别识别不一致的情况", 403);
            }
            isFreeRetryAllowed = true;
        }

        // face-analyze 已用同一 sessionId 预占额度（TestRecord 已写入）时，analyze 复用该预占：
        // 跳过限额预检与重复预占，避免把自己的预占计入已用数导致"最后一次额度"被误拒。
        // 仅当会话尚未完成时成立——已完成的会话必须走正常限额 + 缓存路径，
        // 防止用历史已完成 sessionId 的 TestRecord 绕过限额白嫖新分析。
        // 同时校验 TestRecord 归属当前登录用户：游客/他人 sessionId 不能借此绕过登录与限额。
        let hasPriorReservation = false;
        if (!isFreeRetryAllowed && sessionId && user) {
            const [priorRecord, priorSession] = await Promise.all([
                prisma.testRecord.findUnique({ where: { sessionId }, select: { userId: true } }),
                prisma.advisorSession.findUnique({
                    where: { sessionId },
                    select: {
                        completedAt: true,
                        faceScanStartedAt: true,
                        faceScanCompletedAt: true,
                        analysisResult: true,
                    },
                }),
            ]);
            hasPriorReservation = priorRecord?.userId === user.id && !priorSession?.completedAt;

            // 产品决策：不允许跳过扫脸，任何新报告都必须基于服务端已持久化的面部结果。
            // 在预占额度前拦截，避免“只填问卷也扣一次”的无效消耗。
            const persistedFace = (priorSession?.analysisResult as Record<string, unknown> | null)?.faceAnalysis;
            const hasFace = !!priorSession?.faceScanCompletedAt || !!persistedFace;
            if (!hasFace) {
                const faceInProgress = !!priorSession?.faceScanStartedAt
                    && Date.now() - new Date(priorSession.faceScanStartedAt).getTime() <= 5 * 60 * 1000;
                if (faceInProgress) {
                    return NextResponse.json(
                        { status: "analyzing", phase: "face_analyzing", sessionId, message: "面部分析进行中，请稍候" },
                        { status: 202, headers: rateLimitHeaders }
                    );
                }
                return apiError("FACE_REQUIRED", "请先完成扫脸分析后再生成报告", 400);
            }
        }

        if (!isFreeRetryAllowed) {
            // 清理僵尸会话：超过阈值仍未完成的 analysis（服务器崩溃、网络中断等）
            // 不清除则这些会话的 analysisStartedAt 会持续占用配额。
            // 阈值 5 分钟 > 最坏耗时（队列等待 60s + face 100s + LLM 90s），避免误杀在途分析。
            // 游客已被下方限额预检 401 拦截，不再按 userId: null + IP 哈希清理历史游客会话。
            if (user) {
                const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
                await prisma.advisorSession.updateMany({
                    where: { userId: user.id, analysisStartedAt: { lt: staleBefore }, completedAt: null },
                    data: { analysisStartedAt: null },
                });
                // 免费重试失败/进程被杀：completedAt 仍在，但 analysisStartedAt 已过期，
                // 同样要清理，否则 session/status 会一直判定"重试进行中"。
                await prisma.advisorSession.updateMany({
                    where: { userId: user.id, analysisStartedAt: { lt: staleBefore }, completedAt: { not: null } },
                    data: { analysisStartedAt: null },
                });
            }

            // 内部异步任务：原请求已完成额度预检，这里跳过重复查询；reserveUsage 仍会原子校验
            if (!hasPriorReservation && !isInternalReportJob) {
                const usageLimit = await checkUsageLimit(request);
                if (!usageLimit.canTest) {
                    // 游客测肤需登录：返回 401（非 429），前端据此引导登录
                    if (usageLimit.requireLogin) {
                        return NextResponse.json(
                            { success: false, error: { code: ErrorCode.UNAUTHORIZED, message: usageLimit.error }, requireLogin: true },
                            { status: 401 }
                        );
                    }
                    return apiError(ErrorCode.RATE_LIMITED, usageLimit.error || "您已达到今日测试上限", 429);
                }
            }
        }

        // 注入地理位置 (如果用户未提供)
        if (!answers.location && geoLocation) {
            answers.location = `${geoLocation.region || ''} ${geoLocation.city || ''}`.trim();
        }

        // 6b. 原子性预占额度（免费重试不扣费）
        // 确保 sessionId 存在：若客户端未传，服务端生成一个，防止绕过 reserveUsage
        effectiveSessionId = sessionId || crypto.randomUUID();

        // 幂等性：同一 sessionId 已完成分析，直接返回已有结果（防止刷新页面重复扣费/重复跑 AI）
        // 免费重试场景不走缓存，因为需要重新生成分析结果
        if (!isFreeRetryAllowed && effectiveSessionId) {
            const existingSession = await prisma.advisorSession.findUnique({
                where: { sessionId: effectiveSessionId },
                select: { completedAt: true, analysisResult: true, archivedAt: true, userId: true, ip: true }
            });
            if (existingSession && isReportCompleted(existingSession.analysisResult)) {
                // 归属校验：仅会话所有者可读取缓存结果（防止 IDOR 读他人完整报告）
                const owned = user?.id
                    ? existingSession.userId === user.id
                    : existingSession.ip === hashIP(ip);
                if (!owned || existingSession.archivedAt) {
                    return apiError(ErrorCode.NOT_FOUND, "报告不存在或无权访问", 404);
                }
                const cachedResult = existingSession.analysisResult as Record<string, unknown>;
                if (process.env.NODE_ENV !== "production") console.log(`[analyze] Returning cached result for completed session ${effectiveSessionId}`);
                return NextResponse.json(cachedResult, { status: 200, headers: rateLimitHeaders });
            }
        }

        // 报告异步任务（REPORT_ASYNC_ENABLED=true 时启用）：
        // 本请求只做预检并返回 202，真正的生成通过 after() 在本机另起一次正常 analyze 请求，
        // 复用同一套完整流程（不复制生成代码）。__reportJob 防止递归。
        if (process.env.REPORT_ASYNC_ENABLED === "true"
            && !isFreeRetryAllowed
            && !isInternalReportJob
            && effectiveSessionId) {
            const jobSessionId = effectiveSessionId;
            const port = process.env.PORT || "3002";
            const target = process.env.REPORT_JOB_URL || `http://127.0.0.1:${port}/api/advisor/analyze`;
            const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://smart.nihplod.cn";
            const cookie = request.headers.get("cookie") || "";
            const forwardedFor = request.headers.get("x-forwarded-for");
            const realIp = request.headers.get("x-real-ip");
            const userAgent = request.headers.get("user-agent");
            const jobBody = { ...(body as Record<string, unknown>), __reportJob: true, async: false };

            // 只负责“点火”，不 await 自请求：after 回调不应占用原路由的 maxDuration，
            // 否则自请求可能被原请求的超时截断。fetch 的 open handle 会继续跑完。
            after(() => {
                const headers = new Headers({
                    "content-type": "application/json",
                    origin: siteOrigin,
                    referer: `${siteOrigin}/result`,
                });
                if (cookie) headers.set("cookie", cookie);
                if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
                if (realIp) headers.set("x-real-ip", realIp);
                if (userAgent) headers.set("user-agent", userAgent);

                void fetch(target, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(jobBody),
                    signal: AbortSignal.timeout(90_000),
                }).then(async (res) => {
                    if (!res.ok) {
                        const text = await res.text().catch(() => "");
                        logger.error("[analyze] async report job failed", {
                            status: res.status,
                            sessionId: jobSessionId,
                            body: text.slice(0, 200),
                        });
                    }
                }).catch((error) => {
                    logger.error("[analyze] async report job request error", {
                        error: String(error),
                        sessionId: jobSessionId,
                    });
                });
            });

            return NextResponse.json(
                { status: "analyzing", phase: "text_analyzing", sessionId: jobSessionId, async: true },
                { status: 202, headers: rateLimitHeaders }
            );
        }

        if (!isFreeRetryAllowed) {
            if (hasPriorReservation) {
                // 复用 face-analyze 的既有预占；续租延后到本请求 claim 成功之后，
                // 避免并发请求在输掉 claim 时提前使赢家的 rollback token 失效。
                reservedResult = {
                    success: true,
                    role: "member",
                    alreadyReserved: true,
                    userId: user!.id,
                };
                reservationUserId = user!.id;
                needsPriorLeaseRenewal = true;
            } else {
                const reserved = await reserveUsage(request, effectiveSessionId);
                if (!reserved.success) {
                    // 兜底：checkUsageLimit 预检之后身份状态变化（如登出），游客按 401 处理
                    if (reserved.requireLogin) {
                        return NextResponse.json(
                            { success: false, error: { code: ErrorCode.UNAUTHORIZED, message: reserved.error }, requireLogin: true },
                            { status: 401 }
                        );
                    }
                    if (reserved.forbidden) {
                        return apiError(ErrorCode.NOT_FOUND, reserved.error || "报告会话不存在或无权访问", 404);
                    }
                    const response = apiError(ErrorCode.RATE_LIMITED, reserved.error || "您已达到今日测试上限", 429);
                    Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v));
                    return response;
                }
                reservedResult = reserved;
                reservationUserId = reserved.userId ?? user?.id;
            }
        }

        // 清理该 session 的僵尸分析标记（免费重试同样适用）：
        // 5 分钟 > 队列等待 + 视觉/文本最坏耗时，避免误杀在途请求。
        const staleAnalysisBefore = new Date(Date.now() - 5 * 60 * 1000);
        await prisma.advisorSession.updateMany({
            where: { sessionId: effectiveSessionId, analysisStartedAt: { lt: staleAnalysisBefore } },
            data: { analysisStartedAt: null },
        });

        // 并发保护：先插入占位行，再对 analysisStartedAt 做条件 claim。
        // 原实现 SELECT ... FOR UPDATE 对“不存在的行”不加锁，两个并发请求都能通过。
        const lockResult = await prisma.$transaction(async (tx) => {
            await tx.advisorSession.upsert({
                where: { sessionId: effectiveSessionId },
                update: {},
                create: {
                    sessionId: effectiveSessionId,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    answers: answers as any,
                    ip: ipHash,
                    userId: user?.id || null,
                    faceScanUsed: false,
                },
            });

            const session = await tx.advisorSession.findUnique({
                where: { sessionId: effectiveSessionId },
                select: {
                    completedAt: true,
                    analysisStartedAt: true,
                    faceScanStartedAt: true,
                    faceScanCompletedAt: true,
                    analysisResult: true,
                    answers: true,
                    ip: true,
                    userId: true,
                }
            });

            const serverFace = (session?.analysisResult as Record<string, unknown> | null)?.faceAnalysis as
                | FaceAnalysisResult
                | undefined;

            // 会话归属：不允许在他人未完成会话上跑 AI / 写报告
            if (session?.userId && session.userId !== user?.id) {
                return { status: 'forbidden' as const };
            }

            // 视觉分析仍在进行：先让客户端轮询，避免文本报告先落库、face 结果后到而错位
            if (
                !serverFace
                && session?.faceScanStartedAt
                && !session.faceScanCompletedAt
                && session.faceScanStartedAt > staleAnalysisBefore
            ) {
                return { status: 'analyzing' as const, phase: 'face_analyzing' as const };
            }

            // 强制扫脸：没有服务端面部结果不得生成报告（避免纯问卷报告冒充测肤报告）。
            if (!serverFace) {
                return { status: 'face_required' as const };
            }

            // 再次检查是否已完成（可能刚刚完成）。免费重试需要重新跑 AI，不走缓存。
            if (!isFreeRetryAllowed && isReportCompleted(session?.analysisResult)) {
                const owned = user?.id
                    ? session?.userId === user.id
                    : session?.ip === hashIP(ip);
                if (!owned) {
                    return { status: 'forbidden' as const };
                }
                return { status: 'completed' as const, result: session?.analysisResult };
            }

            // 免费重试原子性防护（ownership + freeRetryUsed 均在事务内校验，消除 TOCTOU 窗口）：
            if (isFreeRetryAllowed) {
                if (!session || !isReportCompleted(session.analysisResult)) {
                    return { status: 'free_retry_invalid' as const };
                }
                const currentIpHash = hashIP(ip);
                if (user?.id) {
                    if (session.userId !== user.id) {
                        return { status: 'free_retry_invalid' as const };
                    }
                } else if (session.ip && session.ip !== currentIpHash) {
                    return { status: 'free_retry_invalid' as const };
                }
                const existingResult = session.analysisResult as Record<string, unknown>;
                if (existingResult?.freeRetryUsed) {
                    return { status: 'free_retry_used' as const };
                }
                if (!isValidFreeRetryReason(existingResult, session.answers)) {
                    return { status: 'free_retry_invalid' as const };
                }
            }

            // 若已有其他请求正在分析，返回 analyzing 状态，让客户端轮询。
            const retryInProgress = !!session?.completedAt
                && !!session?.analysisStartedAt
                && new Date(session.analysisStartedAt).getTime() > new Date(session.completedAt).getTime();
            if (session?.analysisStartedAt && (!session?.completedAt || retryInProgress)) {
                return { status: 'analyzing' as const, phase: 'text_analyzing' as const };
            }

            const consentFields = privacyConsent ? {
                privacyConsentAt: new Date(privacyConsent.consentedAt),
                privacyConsentVersion: privacyConsent.version
            } : {};

            // 原子 claim：只有成功把 analysisStartedAt 从 null 置为当前时间的请求才能跑 AI。
            // 免费重试允许 completedAt 保留（旧报告），用 analysisStartedAt 表示重试进行中。
            const claimed = await tx.advisorSession.updateMany({
                where: {
                    sessionId: effectiveSessionId,
                    analysisStartedAt: null,
                    ...(isFreeRetryAllowed ? {} : { completedAt: null }),
                    AND: [
                        // 会话归属：本人会话，或同 IP 哈希的未归属游客会话；
                        // 不能仅凭 sessionId 把他人未归属会话写到自己账号下
                        {
                            OR: user?.id
                                ? [{ userId: user.id }, { userId: null, ip: ipHash }]
                                : [{ userId: null, ip: ipHash }],
                        },
                        // 视觉分析进行中时不参与文本 claim（若已 face 完成可继续）
                        { OR: [{ faceScanCompletedAt: { not: null } }, { faceScanStartedAt: null }] },
                    ],
                },
                data: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    answers: answers as any,
                    analysisSource: serverFace ? "hybrid" : "text",
                    faceScanUsed: !!serverFace,
                    analysisStartedAt: new Date(),
                    province: geoLocation?.region,
                    city: geoLocation?.city,
                    ip: ipHash,
                    userId: user?.id || null,
                    ...consentFields,
                },
            });

            if (claimed.count === 0) {
                const after = await tx.advisorSession.findUnique({
                    where: { sessionId: effectiveSessionId },
                    select: {
                        analysisStartedAt: true,
                        analysisResult: true,
                        userId: true,
                        faceScanStartedAt: true,
                        faceScanCompletedAt: true,
                    },
                });
                if (
                    !isFreeRetryAllowed
                    && after?.userId === user?.id
                    && isReportCompleted(after?.analysisResult)
                ) {
                    return { status: 'completed' as const, result: after?.analysisResult };
                }
                const afterFace = (after?.analysisResult as Record<string, unknown> | null)?.faceAnalysis;
                const phase = !afterFace && after?.faceScanStartedAt && !after?.faceScanCompletedAt
                    ? 'face_analyzing' as const
                    : 'text_analyzing' as const;
                return { status: 'analyzing' as const, phase };
            }

            return { status: 'started' as const, faceAnalysis: serverFace ?? null };
        });

        if (lockResult.status === 'forbidden') {
            // 竞态窗口内完成的会话不属于当前请求者：退还本次预占并返回 404（不暴露会话存在性）
            if (reservedResult && !reservedResult.alreadyReserved) {
                await rollbackUsage(request, effectiveSessionId, reservationUserId, reservedResult?.leaseToken);
            }
            return apiError(ErrorCode.NOT_FOUND, "报告不存在或无权访问", 404);
        }

        if (lockResult.status === 'completed') {
            const cachedResult = lockResult.result as Record<string, unknown>;
            // 返回缓存时退还本次预占：仅当本请求实际新增了计数时才回滚
            //（P2002 幂等命中时 alreadyReserved=true，回滚会误删其他请求的预占）
            if (reservedResult && !reservedResult.alreadyReserved) {
                await rollbackUsage(request, effectiveSessionId, reservationUserId, reservedResult?.leaseToken);
            }
            console.log(`[analyze] Returning cached result after lock for session ${effectiveSessionId}`);
            return NextResponse.json(cachedResult, { status: 200, headers: rateLimitHeaders });
        }

        if (lockResult.status === 'face_required') {
            // 无面部结果不得生成报告；若本请求已预占额度，立即退还。
            if (reservedResult && !reservedResult.alreadyReserved) {
                await rollbackUsage(request, effectiveSessionId, reservationUserId, reservedResult.leaseToken);
            }
            return apiError("FACE_REQUIRED", "请先完成扫脸分析后再生成报告", 400);
        }

        if (lockResult.status === 'free_retry_used') {
            const response = apiError(ErrorCode.RATE_LIMITED, "免费重试已使用，每个会话仅限一次", 429);
            Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v));
            return response;
        }

        if (lockResult.status === 'free_retry_invalid') {
            return apiError(ErrorCode.FORBIDDEN, "免费重试无效：请重新进行测试", 403);
        }

        if (lockResult.status === 'analyzing') {
            return NextResponse.json(
                {
                    status: "analyzing",
                    phase: lockResult.phase ?? "text_analyzing",
                    sessionId: effectiveSessionId,
                    message: "分析正在进行中，请稍候",
                },
                { status: 202, headers: rateLimitHeaders }
            );
        }

        if (lockResult.status !== 'started') {
            return apiError(ErrorCode.INTERNAL_ERROR, "分析状态异常，请重试", 500);
        }

        // 本请求已成功 claim，才续租既有预占：使先前请求的 rollback token 失效，
        // 同时不误伤仍在正常执行的赢家。
        if (needsPriorLeaseRenewal && user && reservedResult) {
            const renewed = await renewUsageLease(effectiveSessionId, user.id);
            if (renewed.success) {
                if (renewed.leaseToken) {
                    reservedResult = { ...reservedResult, leaseToken: renewed.leaseToken };
                }
            } else {
                // 预占在 claim 前被原请求回滚/清理：重新走一次原子预占，
                // 否则本请求会在没有任何 TestRecord 的情况下跑 AI（少计额度）。
                const reReserved = await reserveUsage(request, effectiveSessionId);
                if (!reReserved.success) {
                    await clearAnalysisStartedAt(effectiveSessionId);
                    if (reReserved.requireLogin) {
                        return NextResponse.json(
                            { success: false, error: { code: ErrorCode.UNAUTHORIZED, message: reReserved.error }, requireLogin: true },
                            { status: 401 }
                        );
                    }
                    if (reReserved.forbidden) {
                        return apiError(ErrorCode.NOT_FOUND, reReserved.error || "报告会话不存在或无权访问", 404);
                    }
                    const response = apiError(ErrorCode.RATE_LIMITED, reReserved.error || "您已达到今日测试上限", 429);
                    Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v));
                    return response;
                }
                reservedResult = reReserved;
                reservationUserId = reReserved.userId ?? user.id;
            }
        }

        // 只使用 /face-analyze 服务端持久化的结果；客户端 faceAnalysis 已不再读取。
        const faceAnalysis = lockResult.faceAnalysis;
        if (faceAnalysis) {
            enforceZoneAdviceIngredients(faceAnalysis.zoneAnalysis, answers.allergies);
        }

        // 5. 构建 AI 提示词与调用
        // Resolve Skin Type (Priority: Face Analysis > User Answer)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalSkinType = determineSkinType(answers, (faceAnalysis as any) || undefined);
        const skinTypeLabel = getSkinTypeLabel(finalSkinType);
        const enrichedAnswers = { ...answers, skinType: finalSkinType };

        // FETCH PRODUCTS (Candidate Selection / RAG Lite)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const concerns = identifyConcerns(enrichedAnswers as any, faceAnalysis as any);
        // 确定性诊断：AI 成功时用于证据补齐，AI 失败时直接生成规则版报告
        const diagnosis = buildDiagnosis({
            faceAnalysis,
            answers: answers as Record<string, unknown>,
        });
        // Determine persona via matchCharacterIP (8-pie system)
        const personaKey = matchCharacterIP({
            score: faceAnalysis?.overallScore ?? 0,
            skinType: finalSkinType,
            budget: answers.budget,
            skincareFrequency: answers.skincareFrequency,
        }).key;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const candidateProducts = await getCandidateProducts(enrichedAnswers as any, concerns, 6, personaKey, envContext);

        // 产品推荐与文本 AI 并行：算法推荐不依赖 AI 文案，提前启动可缩短总耗时
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const algorithmRecsPromise = recommendProducts(enrichedAnswers as any, concerns, candidateProducts, 3, personaKey, envContext)
            .catch((error) => {
                logger.warn("[Analyze] algorithm product recommendations failed (non-fatal)", {
                    error: String(error),
                });
                return [] as ProductRecommendation[];
            });

        // 派系护肤方案骨架（result-content.json 的 m4 早晚节奏 + m7 护肤公式），
        // 注入 prompt 让 AI 在既定方案上做个性化微调，而非从零编写
        const personaContent = ((): PersonaRoutineContext | undefined => {
            const personaData = getSkinTypeByIpKey(personaKey);
            if (!personaData) return undefined;
            return {
                typeName: personaData.typeName,
                morning: personaData.m4?.morning,
                night: personaData.m4?.night,
                note: personaData.m4?.note,
                formulaCore: personaData.m7?.formulaCore,
                formulaSuggestions: personaData.m7?.suggestions?.map((s) => `${s.title}：${s.content}`),
            };
        })();

        const userPrompt = buildConsultantPrompt({
            skinTypeLabel,
            ageRange: answers.ageRange,
            concerns,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            gender: (answers as any).gender,
            location: geoLocation ? `${geoLocation.region || ''} ${geoLocation.city || ''}（${envContext.description}）`.trim() : undefined,
            budget: answers.budget,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            medicalBeauty: (answers as any).medicalBeauty,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sleep: (answers as any).sleepQuality,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stressLevel: (answers as any).stressLevel,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            waterIntake: (answers as any).waterIntake,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            exerciseFrequency: (answers as any).exerciseFrequency,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dietaryHabits: (answers as any).dietaryHabits,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sunExposure: (answers as any).sunExposure,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            skincareFrequency: (answers as any).skincareFrequency,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            skincareLevel: (answers as any).skincareLevel,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            allergies: (answers as any).allergies,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pregnancyStatus: (answers as any).pregnancy ?? (answers as any).pregnancyStatus,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            menstrualCycle: (answers as any).menstrualCycle,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            medicationHistory: (answers as any).medicationHistory,
            isLoggedIn: !!user,
            faceAnalysis: faceAnalysis ? {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                skinType: faceAnalysis.skinType as any,
                dimensions: faceAnalysis.dimensions,
                overallScore: faceAnalysis.overallScore,
                zoneAnalysis: faceAnalysis.zoneAnalysis,
                skinAge: faceAnalysis.skinAge,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                skinConditions: (faceAnalysis as any).skinConditions,
            } as Partial<FaceAnalysisResult> : undefined,
            scoring: faceAnalysis?.scoring,
            products: candidateProducts,
            skinState,
            personaContent,
            diagnosisFindings: diagnosis.findings.map((finding) => ({
                id: finding.id,
                title: finding.title,
                severity: finding.severity,
                score: finding.score,
                relatedDimensions: finding.evidenceRefs
                    .filter((ref) => ref.type === "dimension")
                    .map((ref) => ref.key),
                evidence: finding.evidenceRefs.map((ref) =>
                    `${ref.label || ref.key}${typeof ref.score === "number" ? ` ${ref.score} 分` : ""}`
                ),
            })),
        });

        // 顾问叙事报告（Report v2）：面诊口吻 + 推理链 + 证据驱动，统一由一个模型产出全部文案
        const systemPrompt = CONSULTANT_SYSTEM_PROMPT;

        // 调用 AI
        // provider 必须走 getAISettings 的白名单 sanitize：直读 env 会绕过校验，
        // 且可能与 settings.model 错位（env 是 qwen 但 DB model 是 deepseek 系）
        const settings = await getAISettings();
        const provider = settings.provider;
        const textRouting = selectRoutedTextModel(provider, diagnosis.findings);
        const routedTextModel = textRouting.model;

        // v2-only：AI 失败不再降级为 v1 规则报告。
        // 解析失败先做一次 JSON 修复重试；仍失败则返回可重试错误（同 session 重试不再扣次）
        let consultantReport: ConsultantReport | null = null;
        // 解析失败时记录 AI 原始输出片段，便于定位模型返回了什么（截断/字段不符/非 JSON）
        let rawAiOutput: string | undefined;
        let queueAcquired = false;
        // ReportV3：区分 AI 文案与规则兜底；兜底原因写入 reportV3.meta 供质量看板
        let narrativeSource: ReportNarrativeSource = "ai";
        let fallbackReason: string | undefined;

        // 孕期状态（含"不确定"按谨慎处理）：用于报告文本的孕期禁忌成分硬校验
        const pregnancyRaw = (answers.pregnancy ?? answers.pregnancyStatus) as string | undefined;
        const pregnancyCautious = pregnancyRaw === "yes" || pregnancyRaw === "unknown";

        // 解析 + 字段清洗 + 成分/孕期硬校验（初始输出与修复重试共用）
        const finalizeConsultantReport = (text: string): ConsultantReport => {
            const report = sanitizeConsultantReport(parseConsultantReport(text));
            const violations = enforceConsultantReportIngredients(report, {
                pregnancy: pregnancyCautious,
                allergies: (answers as { allergies?: string | string[] }).allergies,
            });
            if (violations.length > 0) {
                aiLogger.warn(
                    `[IngredientGuard] v2 报告成分命中 ${violations.length} 处：` +
                    violations.map((v) => `${v.field}/${v.keyword}(${v.type})`).join(", ")
                );
            }
            return report;
        };
        try {
            // 内层 try：AI 文案失败时降级为规则模板报告，不阻断整个报告生成。
            // 客户端取消/服务端超时仍上抛，由外层 catch 走取消/超时语义。
            let textStartedAt = 0;
            try {
            // P3: 请求队列处理 - 申请令牌（防止并发过高打爆 LLM API）
            // 透传 userId 使队列的 maxConcurrentPerUser 生效
            // 队列等待计入总预算：最多等 30s，给文本 AI 留出约 50s
            // （原默认 60s 会让生成阶段只剩 25-30s，必然撞 85s 路由超时）
            const queueStartedAt = Date.now();
            await analysisQueue.acquire({ timeoutMs: 15_000, signal: abortController.signal, userId: user?.id });
            queueAcquired = true;
            stageTimings.queueWaitMs = Date.now() - queueStartedAt;

            // 记录队列状态到响应头
            const queueStats = analysisQueue.getStats();
            rateLimitHeaders["X-Queue-Position"] = String(queueStats.queueLength);
            rateLimitHeaders["X-Queue-Wait-Seconds"] = String(queueStats.estimatedWaitSeconds);

            // 排队期间客户端可能已断开
            if (abortController.signal.aborted) {
                throw new Error("Request cancelled during queue wait.");
            }

            // 熔断器检查（纯查询，不消耗半开探测名额；名额由 ai.ts 内部调用点统一管理）
            const textServiceKey = `text-${provider}`;
            if (circuitBreaker.isBlocked(textServiceKey)) {
                throw new Error(`[CircuitBreaker] Text AI service ${provider} is temporarily unavailable`);
            }

            // 队列等待已消耗预算：给文本模型传剩余时间，避免内层 80s 超时晚于路由 85s abort
            const remainingTextBudgetMs = () => Math.max(5_000, 85_000 - (Date.now() - requestStartedAt) - 5_000);
            textStartedAt = Date.now();
            rawAiOutput = await generateText(
                systemPrompt,
                userPrompt,
                provider as AIProvider,
                abortController.signal,
                user?.id,
                effectiveSessionId,
                remainingTextBudgetMs(),
                routedTextModel
            );
            try {
                consultantReport = finalizeConsultantReport(rawAiOutput);
            } catch (parseErr: unknown) {
                // 一次 JSON 修复重试：把解析失败原因回传模型，要求只输出完整 JSON。
                // 仅在剩余时间预算充足时重试：路由总预算 90s（serverTimeout），
                // 若首次生成已耗时较多，再跑一次会撞上 90s 超时反而不如直接走可重试错误
                const elapsedMs = Date.now() - requestStartedAt;
                const REPAIR_RETRY_DEADLINE_MS = 40 * 1000;
                const reason = parseErr instanceof Error ? parseErr.message : String(parseErr);
                if (elapsedMs >= REPAIR_RETRY_DEADLINE_MS) {
                    aiLogger.warn("AI report parse failed; skip repair retry (insufficient time budget)", {
                        error: reason,
                        elapsedMs,
                    });
                    throw parseErr;
                }
                const isSchemaIssue = reason.includes("schema validation failed");
                aiLogger.warn("AI report parse failed, retrying once with repair instruction", {
                    error: reason,
                    elapsedMs,
                    aiOutputLength: rawAiOutput.length,
                    aiOutputHash: crypto.createHash("sha256").update(rawAiOutput).digest("hex").slice(0, 16),
                });
                const repairPrompt = `${userPrompt}\n\n【格式修复】上一次输出无法解析（${isSchemaIssue ? "字段结构不符合上述 JSON 要求" : "不是合法 JSON 或输出被截断"}）。请严格按上述 JSON 结构重新输出完整结果：不要 Markdown 代码块、不要任何解释文字，确保所有字段完整且 JSON 正确闭合。`;
                const repairText = await generateText(
                    systemPrompt,
                    repairPrompt,
                    provider as AIProvider,
                    abortController.signal,
                    user?.id,
                    effectiveSessionId,
                    remainingTextBudgetMs(),
                    routedTextModel
                );
                rawAiOutput = repairText;
                consultantReport = finalizeConsultantReport(repairText);
            }
            } catch (aiErr: unknown) {
                const err = aiErr instanceof Error ? aiErr : new Error(String(aiErr));
                // 客户端取消 / 服务端超时不走兜底：前者用户已离开，后者外层有明确重试语义
                if (err.message?.includes("cancelled") || err.name === "AbortError") {
                    throw err;
                }
                const errorCategory = err.message?.includes("AI response schema validation failed")
                    ? "AI_SCHEMA_INVALID" : err.message?.includes("Failed to extract valid JSON")
                    ? "AI_JSON_PARSE" : err.message?.includes("401") || err.message?.includes("403")
                    ? "AI_AUTH" : err.message?.includes("429")
                    ? "AI_RATE_LIMIT" : err.message?.includes("timeout") || err.message?.includes("ETIMEDOUT")
                    ? "AI_TIMEOUT" : "AI_UNKNOWN";
                aiLogger.warn(`[ReportV3] AI narrative failed [${errorCategory}], using rule fallback`, {
                    error: err.message.slice(0, 300),
                    ...(["AI_JSON_PARSE", "AI_SCHEMA_INVALID"].includes(errorCategory) && rawAiOutput
                        ? {
                            aiOutputLength: rawAiOutput.length,
                            aiOutputHash: crypto.createHash("sha256").update(rawAiOutput).digest("hex").slice(0, 16),
                        }
                        : {}),
                });
                const fallbackReport = buildFallbackConsultantReport({
                    faceAnalysis,
                    answers: answers as Record<string, unknown>,
                    diagnosis,
                });
                // 兜底文本也走同一成分/孕期硬校验，避免规则模板绕过安全约束
                enforceConsultantReportIngredients(fallbackReport, {
                    pregnancy: pregnancyCautious,
                    allergies: (answers as { allergies?: string | string[] }).allergies,
                });
                consultantReport = fallbackReport;
                narrativeSource = "fallback";
                fallbackReason = errorCategory + ": " + err.message.slice(0, 240);
            }

            // 规则诊断优先：AI 叙述未覆盖规则生成的重点问题时，降级为规则报告，
            // 避免 AI 漏报或凭空新增问题导致报告与评分证据不一致。
            if (consultantReport && !narrativeMatchesDiagnosis(consultantReport, diagnosis)) {
                aiLogger.warn("[ReportV3] AI narrative does not match deterministic diagnosis, using fallback", {
                    diagnosisFindings: diagnosis.findings.length,
                    aiIssues: consultantReport.issues.length,
                });
                const fallbackReport = buildFallbackConsultantReport({
                    faceAnalysis,
                    answers: answers as Record<string, unknown>,
                    diagnosis,
                });
                enforceConsultantReportIngredients(fallbackReport, {
                    pregnancy: pregnancyCautious,
                    allergies: (answers as { allergies?: string | string[] }).allergies,
                });
                consultantReport = fallbackReport;
                narrativeSource = "fallback";
                fallbackReason = "NARRATIVE_MISMATCH";
            }
            if (textStartedAt > 0) {
                stageTimings.textGenerationMs = Date.now() - textStartedAt;
            }
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            if (err.message?.includes("cancelled") || err.name === 'AbortError') {
                if (serverTimedOut) {
                    // 服务端 85s 预算耗尽不是客户端取消，必须允许重试并退还未被 AI 消费的额度
                    logger.warn("Text analysis aborted by server timeout");
                    const [visionConsumed, textConsumed] = await Promise.all([
                        hasSuccessfulFaceAnalysis(effectiveSessionId),
                        hasSuccessfulTextAnalysis(effectiveSessionId),
                    ]);
                    if (reservedResult && !reservedResult.alreadyReserved && !visionConsumed && !textConsumed) {
                        await rollbackUsage(request, effectiveSessionId, reservationUserId, reservedResult?.leaseToken);
                    }
                    await clearAnalysisStartedAt(effectiveSessionId);
                    const response = apiError(ErrorCode.AI_SERVICE_ERROR, "报告生成超时，请点击重试", 503);
                    response.headers.set("Retry-After", "30");
                    return response;
                }

                logger.warn("Text analysis cancelled (client disconnect)");
                // 仅排队等待期间取消时回滚：此时 AI 尚未被调用，零消耗
                // AI 调用进行中取消不回滚：API 可能已处理并计费
                const isQueueOnlyCancel = err.message === "Request cancelled during queue wait.";
                if (isQueueOnlyCancel) {
                    if (reservedResult && !reservedResult.alreadyReserved && !(await hasSuccessfulFaceAnalysis(effectiveSessionId))) {
                        await rollbackUsage(request, effectiveSessionId, reservationUserId, reservedResult?.leaseToken);
                    }
                }
                await clearAnalysisStartedAt(effectiveSessionId);
                return apiError(ErrorCode.INTERNAL_ERROR, "分析请求已取消，请重试", 499);
            }
            if (err.message?.includes("[AIUserLimit]")) {
                // 单用户日限：用户侧限额（429 + 明确原因），不回退为"服务暂不可用"的平台口径
                aiLogger.warn("User daily AI limit reached", { error: err.message });
                if (reservedResult && !reservedResult.alreadyReserved && !(await hasSuccessfulFaceAnalysis(effectiveSessionId))) {
                    await rollbackUsage(request, effectiveSessionId, reservationUserId, reservedResult?.leaseToken);
                }
                await clearAnalysisStartedAt(effectiveSessionId);
                const msg = err.message.replace("[AIUserLimit]", "").trim() || "今日分析次数已达上限";
                return apiError("USER_DAILY_LIMIT", msg, 429);
            }
            if (err.message?.includes("[AIBudget]")) {
                aiLogger.warn("AI budget exceeded, rejecting request", { error: err.message });
                if (reservedResult && !reservedResult.alreadyReserved && !(await hasSuccessfulFaceAnalysis(effectiveSessionId))) {
                    await rollbackUsage(request, effectiveSessionId, reservationUserId, reservedResult?.leaseToken);
                }
                await clearAnalysisStartedAt(effectiveSessionId);
                const response = apiError("AI_BUDGET_EXCEEDED", "服务暂不可用，请稍后重试", 503);
                response.headers.set("Retry-After", "3600");
                return response;
            }
            if (err.message?.includes("[CircuitBreaker]")) {
                aiLogger.warn("Circuit breaker open, rejecting request", { error: err.message });
                if (reservedResult && !reservedResult.alreadyReserved && !(await hasSuccessfulFaceAnalysis(effectiveSessionId))) {
                    await rollbackUsage(request, effectiveSessionId, reservationUserId, reservedResult?.leaseToken);
                }
                await clearAnalysisStartedAt(effectiveSessionId);
                const response = apiError("AI_CIRCUIT_OPEN", "服务暂不可用，请稍后重试", 503);
                response.headers.set("Retry-After", "60");
                return response;
            }
            // 区分错误类型进行日志记录
            // AI_SCHEMA_INVALID：AI 返回了完整 JSON 但字段不符合 schema（区别于截断导致的 AI_JSON_PARSE）
            const errorCategory = err.message?.includes("AI response schema validation failed")
                ? "AI_SCHEMA_INVALID" : err.message?.includes("Failed to extract valid JSON")
                ? "AI_JSON_PARSE" : err.message?.includes("401") || err.message?.includes("403")
                ? "AI_AUTH" : err.message?.includes("429")
                ? "AI_RATE_LIMIT" : err.message?.includes("timeout") || err.message?.includes("ETIMEDOUT")
                ? "AI_TIMEOUT" : "AI_UNKNOWN";
            aiLogger.warn(`AI generation failed [${errorCategory}] (v2-only, report will fail)`, {
                error: err.message,
                ...(["AI_JSON_PARSE", "AI_SCHEMA_INVALID"].includes(errorCategory) && rawAiOutput
                    ? {
                        aiOutputLength: rawAiOutput.length,
                        aiOutputHash: crypto.createHash("sha256").update(rawAiOutput).digest("hex").slice(0, 16),
                    }
                    : {}),
            });

            // 预占处理：只要本次已成功产生任何 AI 计费（视觉/文本），就保留预占——
            // 同 session 重试命中既有 TestRecord（幂等），不再额外扣次；全部未计费（如鉴权失败）则退还
            const [visionConsumed, textConsumed] = await Promise.all([
                hasSuccessfulFaceAnalysis(effectiveSessionId),
                hasSuccessfulTextAnalysis(effectiveSessionId),
            ]);
            if (reservedResult && !reservedResult.alreadyReserved && !visionConsumed && !textConsumed) {
                await rollbackUsage(request, effectiveSessionId, reservationUserId, reservedResult?.leaseToken);
            }
            await clearAnalysisStartedAt(effectiveSessionId);
            const response = apiError(ErrorCode.AI_SERVICE_ERROR, "报告生成失败，请点击重试（不会额外消耗次数）", 503);
            response.headers.set("Retry-After", "30");
            return response;
        } finally {
            if (queueAcquired) {
                analysisQueue.release();
            }
        }

        // 成功路径必定有报告；此处兜底防御（理论上不可达）
        if (!consultantReport) {
            await clearAnalysisStartedAt(effectiveSessionId);
            const response = apiError(ErrorCode.AI_SERVICE_ERROR, "报告生成失败，请点击重试（不会额外消耗次数）", 503);
            response.headers.set("Retry-After", "30");
            return response;
        }

        // 7. 补全产品详情 — 返回最多3个产品（AI精选 + 算法补足）
        let finalProducts: ProductRecommendation[] = [];

        // 产品推荐已在文本 AI 期间并行启动；此处只等待结果并完成 AI 推荐映射
        const productSelectionStartedAt = Date.now();
        const algorithmRecs = await algorithmRecsPromise;

        type AiProductItem = {
            id?: string | number;
            reason?: string;
            [key: string]: unknown;
        };

        if (consultantReport.productReasons && Array.isArray(consultantReport.productReasons)) {
            const mappedProducts = (consultantReport.productReasons as AiProductItem[]).map((p) => {
                // strict match against candidate pool to enforce RAG boundaries
                const catalogProduct = candidateProducts.find((cp) => String(cp.id) === String(p.id));
                if (catalogProduct) {
                    return {
                        ...p,
                        id: String(catalogProduct.id),
                        name: catalogProduct.name,
                        category: catalogProduct.category,
                        image: catalogProduct.image,
                        images: (catalogProduct as { images?: string[] | null }).images || null,
                        price: catalogProduct.price,
                        description: catalogProduct.description,
                        keyIngredients: catalogProduct.keyIngredients || [],
                        benefits: catalogProduct.benefits || [],
                        affiliateLinks: catalogProduct.affiliateLinks || null,
                        purchaseLinks: catalogProduct.purchaseLinks || null,
                        origin: catalogProduct.origin || null,
                        capacity: catalogProduct.capacity || null,
                        howToUse: catalogProduct.howToUse || null,
                        source: "ai" as const,
                        reason: sanitizeReason(p.reason || algorithmRecs.find((r) => String(r.id) === String(p.id))?.reason || "为您精选的护肤产品")
                    } as unknown as ProductRecommendation;
                }
                return null;
            }).filter((item): item is ProductRecommendation => item !== null);

            if (mappedProducts.length > 0) {
                // AI 主推，不足 3 个时用算法推荐补足
                finalProducts = mappedProducts.slice(0, 3);
                const remaining = algorithmRecs.filter((ar) => !finalProducts.some((p) => String(p.id) === String(ar.id)));
                finalProducts = [...finalProducts, ...remaining].slice(0, 3);
            }
        }

        // 如果 AI 没返回有效产品 (或映射全失败)，使用推荐算法兜底
        if (finalProducts.length === 0) {
            finalProducts = algorithmRecs;
        }

        // 统一清理所有推荐理由中的英文词汇（兜底）
        finalProducts = finalProducts.map((p) => ({
            ...p,
            image: normalizeImagePath(p.image),
            images: p.images ? p.images.map(normalizeImagePath).filter(Boolean) : null,
            reason: sanitizeReason(p.reason)
        }));
        stageTimings.productSelectionMs = Date.now() - productSelectionStartedAt;

        // 8. Construct Final Standardized Result (Matching ComprehensiveResult Interface)

        // 仅使用客户端传来的真实面部分析（用户真的扫过脸）
        const finalFaceAnalysis = faceAnalysis || null;
        if (finalFaceAnalysis) {
            const fa = finalFaceAnalysis as unknown as Record<string, unknown>;
            // Preserve gender if available in original input
            if (faceAnalysis?.gender && !fa.gender) {
                fa.gender = faceAnalysis.gender;
            }
        }

        // v2 顾问报告：details 由各问题的 observation 组成，供旧消费方（历史列表、日记补建）使用
        const consultantObservations = consultantReport.issues.map((i) => i.observation);
        const consultantLifestylePlans = consultantReport.issues.map((i) => i.lifestylePlan);

        // 安全与成分摘要：确定性生成，不额外调用 AI；只向客户端下发可公开展示的结论。
        const safetyStartedAt = Date.now();
        const safetyNotes = buildSafetyNotes({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            allergies: (answers as any).allergies,
            pregnancyStatus: pregnancyRaw,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            medicationHistory: (answers as any).medicationHistory,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            medicalBeauty: (answers as any).medicalBeauty,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            skincareLevel: (answers as any).skincareLevel,
            products: finalProducts.map((product) => ({
                keyIngredients: (product as { keyIngredients?: string[] | null }).keyIngredients ?? null,
            })),
            issues: consultantReport.issues,
        });
        stageTimings.safetyMs = Date.now() - safetyStartedAt;

        const analyzedAtIso = new Date().toISOString();
        // ReportV3：AI 成功/规则兜底都走同一编译器；同时保留 v2 顶层字段
        const reportV3 = compileReportV3({
            faceAnalysis,
            consultantReport,
            products: finalProducts,
            safetyNotes,
            persona: personaKey,
            narrativeSource,
            fallbackReason,
            promptVersion: CONSULTANT_PROMPT_VERSION,
            model: routedTextModel || settings.model,
            dataSource: faceAnalysis ? "hybrid" : "questionnaire",
            analyzedAt: analyzedAtIso,
        });

        const standardizedResult = {
            skinProfile: {
                type: finalSkinType,
                typeLabel: skinTypeLabel,
                concerns: concerns,
                // 无真实面部分析时不落肌龄假数（undefined 经 JSON 序列化后字段缺失，
                // 前端 ResultCards 的 skinAge !== undefined 判断会正确隐藏）
                skinAge: faceAnalysis?.skinAge?.estimated
            },
            analysis: {
                summary: consultantReport.overview,
                details: consultantObservations,
                lifestyleTips: consultantLifestylePlans,
            },
            products: finalProducts,
            faceAnalysis: finalFaceAnalysis, // Ensure faceAnalysis is propagated
            // v2-only：报告必为真实 AI 产出，dataSource 区分扫脸/纯问卷
            dataSource: faceAnalysis ? "hybrid" : "questionnaire",
            persona: personaKey,          // IP 形象 key (8-pie)
            userLocation: geoLocation,
            // 昵称优先用客户端填写值；未填时回退到服务端会话里的用户昵称（主站资料），
            // 避免客户端 localStorage 为空时报告昵称退化为"您"
            nickname: nickname || user?.name || "护肤达人", // Include user nickname for sharing
            analyzedAt: analyzedAtIso, // 证书/报告展示用（随结果持久化，游客流程也可用）
            skinState: typeof skinState === "string" ? skinState : undefined, // 拍摄时肌肤状态（引导页确认后随请求上传；扫脸失败也保留用户声明，历史报告可追溯）
            reportVersion: 3,
            promptVersion: CONSULTANT_PROMPT_VERSION,
            consultantReport,
            safetyNotes,
            reportV3,
        };

        // 清理 AI 输出中的潜在危险内容（存储型 XSS 防护）
        const sanitizedResult = sanitizeAiOutput(standardizedResult) as typeof standardizedResult;

        // 9. Persist Result to DB (all users including guests)
        // effectiveSessionId 总是存在，无需条件检查
        {
            // 报告保留 90 天（游客已被前置 401 拦截，此处仅登录用户可达；TS 兜底同样按 90 天）
            const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

            // 结果与 completedAt 同一次 update 原子写入：避免“结果已保存但 completedAt
            // 失败”的幽灵报告（用户历史/趋势/百分位查不到，且永不进入归档）。
            const existingSession = await prisma.advisorSession.findUnique({
                where: { sessionId: effectiveSessionId },
                select: { analysisResult: true },
            });
            const mergedResult = {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ...(existingSession?.analysisResult as any || {}),
                ...sanitizedResult,
                ...(isFreeRetryAllowed ? { freeRetryUsed: true } : {}),
            };

            const completedAt = new Date();
            const persistStartedAt = Date.now();
            try {
                await withDbRetry(async () => {
                    await prisma.advisorSession.update({
                        where: { sessionId: effectiveSessionId },
                        data: {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            analysisResult: mergedResult as any,
                            analysisSource: faceAnalysis ? "hybrid" : "text",
                            analysisStartedAt: null,
                            completedAt,
                            expiresAt,
                            province: geoLocation?.region,
                            city: geoLocation?.city,
                            userAgent,
                            ...parseUserAgent(userAgent),
                        },
                    });
                });
                stageTimings.persistMs = Date.now() - persistStartedAt;
            } catch (txErr) {
                logger.error("Failed to persist final analysis result:", txErr);
                await clearAnalysisStartedAt(effectiveSessionId);
                const response = apiError(ErrorCode.SERVICE_UNAVAILABLE, "分析结果保存未成功，请重试", 503, "DATABASE_PERSISTENCE_ERROR");
                Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v));
                return response;
            }

            // 汇总表写入失败不影响报告返回；趋势/统计缺失时由回填脚本或下一次测肤恢复
            if (user?.id) {
                try {
                    const assessment = buildSkinAssessment({
                        sessionId: effectiveSessionId,
                        userId: user.id,
                        completedAt,
                        rawResult: mergedResult,
                        faceAnalysis,
                    });
                    if (assessment) {
                        const data = {
                            ...assessment,
                            dimensions: assessment.dimensions as unknown as Prisma.InputJsonValue,
                            zones: assessment.zones as unknown as Prisma.InputJsonValue,
                            conditions: assessment.conditions as unknown as Prisma.InputJsonValue,
                            findings: assessment.findings as unknown as Prisma.InputJsonValue,
                            lowConfidence: assessment.lowConfidence as unknown as Prisma.InputJsonValue,
                            notVisible: assessment.notVisible as unknown as Prisma.InputJsonValue,
                        };
                        await prisma.skinAssessment.upsert({
                            where: { sessionId: effectiveSessionId },
                            update: data,
                            create: data,
                        });
                    }
                } catch (assessmentErr) {
                    logger.warn("[SkinAssessment] upsert failed", {
                        sessionId: effectiveSessionId,
                        error: String(assessmentErr),
                    });
                }
            }

            // 报告质量指标：失败不影响报告返回；供 /admin/report-quality 看板
            try {
                const scoring = faceAnalysis?.scoring;
                const qualityData = {
                    sessionId: effectiveSessionId,
                    userId: user?.id ?? null,
                    narrativeSource,
                    fallbackReason: fallbackReason ?? null,
                    promptVersion: CONSULTANT_PROMPT_VERSION,
                    model: routedTextModel || settings.model,
                    diagnosisFindingCount: diagnosis.findings.length,
                    issueCount: consultantReport.issues.length,
                    coverageScored: scoring?.scoredDimensions ?? 0,
                    coverageTotal: scoring?.totalDimensions ?? 10,
                    lowConfidenceCount: scoring?.lowConfidenceDimensions.length ?? 0,
                    notVisibleCount: scoring?.notVisibleDimensions.length ?? 0,
                    durationMs: Date.now() - requestStartedAt,
                    queueWaitMs: stageTimings.queueWaitMs,
                    textGenerationMs: stageTimings.textGenerationMs,
                    productSelectionMs: stageTimings.productSelectionMs,
                    safetyMs: stageTimings.safetyMs,
                    persistMs: stageTimings.persistMs,
                };
                await prisma.reportQualityLog.upsert({
                    where: { sessionId: effectiveSessionId },
                    update: qualityData,
                    create: qualityData,
                });
                aiLogger.info("[AnalyzeTiming]", {
                    sessionId: effectiveSessionId,
                    ...stageTimings,
                    totalMs: qualityData.durationMs,
                });
            } catch (qualityErr) {
                logger.warn("[ReportQualityLog] upsert failed", {
                    sessionId: effectiveSessionId,
                    error: String(qualityErr),
                });
            }

            // 分析成功落库：把预占标记为 consumed，后续失败路径不得再回滚本次额度
            if (user?.id && reservedResult) {
                await markUsageConsumed(effectiveSessionId, user.id, reservedResult.leaseToken);
            }

            // ====== 护肤日记自动生成：测肤完成后写入/更新当日条目 ======
            // 失败不影响分析响应；仅真实面部分析（faceAnalysis 存在）生成，
            // 纯问卷模式没有分数，不写测肤日记
            const overallScore = finalFaceAnalysis?.overallScore;
            if (user?.id && clientDate && faceAnalysis && typeof overallScore === "number") {
                upsertAutoDiaryEntry({
                    userId: user.id,
                    dateStr: clientDate,
                    score: overallScore,
                    skinTypeLabel,
                    sessionId: effectiveSessionId
                }).catch((err) => logger.error("[Diary] 自动生成日记失败:", err));
            }

            // ====== 微信公众号模板消息推送（通过官网内部 API v1） ======
            if (user?.id && typeof faceAnalysis?.overallScore === "number") {
                const score = Math.round(faceAnalysis.overallScore);
                let primaryConcern = "肤色暗沉或不均";
                if (concerns && concerns.length > 0) {
                    primaryConcern = concerns.join("、");
                }

                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smart.nihplod.cn";
                const reportUrl = `${baseUrl}/reports/${effectiveSessionId}`;

                // 异步触发，绝不阻塞前端响应时间
                sendOfficialWechatTemplate(user.id, score, primaryConcern, reportUrl, effectiveSessionId).catch((err) =>
                    aiLogger.error("[WechatTemplate] 发送函数未捕获异常", { error: String(err) })
                );
            }
        }

        return NextResponse.json(sanitizedResult, { headers: rateLimitHeaders });

    } catch (error: unknown) {
        // 清理 analysisStartedAt，避免 session 在任何异常（AI 失败、超时、取消）后卡在 analyzing
        if (effectiveSessionId) {
            await clearAnalysisStartedAt(effectiveSessionId);

            // 预占后、AI 调用前（行锁/upsert/产品查询/prompt 构建）的异常不能让用户白扣额度。
            // 只有确认本次没有任何成功的视觉/文本 AI 消耗时才回滚。
            if (reservedResult && !reservedResult.alreadyReserved) {
                try {
                    const [visionConsumed, textConsumed] = await Promise.all([
                        hasSuccessfulFaceAnalysis(effectiveSessionId),
                        hasSuccessfulTextAnalysis(effectiveSessionId),
                    ]);
                    if (!visionConsumed && !textConsumed) {
                        await rollbackUsage(request, effectiveSessionId, reservationUserId, reservedResult?.leaseToken);
                    }
                } catch (rollbackError) {
                    logger.warn("[analyze] Failed to check/rollback reservation after unexpected error", {
                        sessionId: effectiveSessionId,
                        error: String(rollbackError),
                    });
                }
            }
        }

        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message?.includes("cancelled") || (err as { name?: string }).name === 'AbortError') {
            return apiError(ErrorCode.INTERNAL_ERROR, "分析请求已取消，请重试", 499);
        }
        // 预算熔断 / 熔断器错误（可能从 AI 调用之外的其他路径逃逸）
        if (err.message?.includes("[AIBudget]")) {
            const response = apiError("AI_BUDGET_EXCEEDED", "当前访问人数较多，请稍后再试。", 503);
            response.headers.set("Retry-After", "3600");
            return response;
        }
        if (err.message?.includes("[CircuitBreaker]")) {
            const response = apiError("AI_CIRCUIT_OPEN", "AI 分析服务暂时不可用，请稍后重试", 503);
            response.headers.set("Retry-After", "60");
            return response;
        }
        // 使用脱敏 logger，避免 error 对象中携带请求上下文/URL 等敏感信息
        aiLogger.error("Advisor analysis failed", {
            errorMessage: err.message,
            errorName: err.name,
            sessionId: effectiveSessionId || undefined,
        });
        return apiError(ErrorCode.INTERNAL_ERROR, "报告生成遇到问题，请重试一次。", 500);
    } finally {
        clearTimeout(serverTimeout);
        request.signal.removeEventListener('abort', onClientAbort);
    }
}
