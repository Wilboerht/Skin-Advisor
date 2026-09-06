import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { generateText, fallbackAnalysis, type AIProvider } from "@/lib/ai";
import { analysisQueue } from "@/lib/ai-queue";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { validateAndExtractJson, TextAnalysisOutputSchema } from "@/lib/advisor-utils";
import { buildTextAnalysisPrompt, TEXT_ANALYSIS_SYSTEM_PROMPT, REGISTERED_USER_DEEP_ANALYSIS_INSTRUCTION } from "@/config/ai-prompts";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import prisma from "@/lib/prisma";
import { getSkinTypeLabel, getConcernLabel, type FaceAnalysisResult } from "@/lib/advisor-utils";
// import { PRODUCTS_CATALOG } from "@/config/products"; // Deprecated, use DB or matchProducts
import { determineSkinType, identifyConcerns } from "@/lib/advisor-utils";
import { AnalyzeRequestSchema } from "@/lib/schemas";
import { upsertAutoDiaryEntry } from "@/lib/diary";
import { recommendProducts, getCandidateProducts, type ProductRecommendation } from "@/lib/recommendations";
import { normalizeImagePath } from "@/types/product";
import { resolveIPLocation } from "@/lib/geoip";
import { getSessionUser } from "@/lib/sso-auth";
import { hashIP } from "@/lib/privacy";
import { matchCharacterIP } from "@/lib/result-utils";
import { getEnvContextFromLocation } from "@/lib/weather-context";

import { checkUsageLimit, reserveUsage, rollbackUsage, type ReserveUsageResult } from "@/lib/usage-limit";
import { extractGuestIdentifiers } from "@/lib/guest-limit";
import { aiLogger, logger } from "@/lib/logger";
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import DOMPurify from 'isomorphic-dompurify';
import { parseUserAgent } from "@/lib/user-agent-parser";

const WECHAT_TEMPLATE_CIRCUIT_KEY = "official-wechat-template";
const WECHAT_TEMPLATE_MAX_RETRIES = 3;
const WECHAT_TEMPLATE_TIMEOUT_MS = 15000;

// 服务端最长执行时间：匹配 90s 客户端/服务端超时上限
export const maxDuration = 90;

/**
 * 调用官网内部 API v1 发送微信模板消息
 *
 * 增强：HMAC-SHA256 签名鉴权 + 熔断 + 指数退避重试 + 超时 + 结构化日志
 */
async function sendOfficialWechatTemplate(
  userId: string,
  score: number,
  primaryConcern: string,
  reportUrl: string
): Promise<void> {
  if (!circuitBreaker.allowRequest(WECHAT_TEMPLATE_CIRCUIT_KEY)) {
    aiLogger.warn("[WechatTemplate] 熔断器开启，跳过官网模板消息推送");
    return;
  }

  const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
  const path = "/api/v1/internal/wechat/send-template";
  const bodyText = JSON.stringify({ userId, score, primaryConcern, reportUrl });

  const signed = await createSignedInternalApiHeaders("advisor", "POST", path, bodyText);
  if (!signed) {
    aiLogger.error("[WechatTemplate] 未配置内部 API 密钥，无法签名请求");
    circuitBreaker.recordFailure(WECHAT_TEMPLATE_CIRCUIT_KEY);
    return;
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < WECHAT_TEMPLATE_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WECHAT_TEMPLATE_TIMEOUT_MS);

    try {
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

/** 清理 Lab 分析状态中的英文词汇 */
function sanitizeLabStatus(status: string): string {
    if (!status) return status;
    const replacements: Record<string, string> = {
        normal: "正常",
        mild: "轻度",
        moderate: "中度",
        severe: "重度",
        good: "良好",
        excellent: "优秀",
        poor: "较差",
        average: "一般",
        fair: "一般",
        low: "低",
        medium: "中等",
        high: "高",
    };
    let sanitized = status;
    for (const [en, cn] of Object.entries(replacements)) {
        // 使用非字母前后断言，避免中文语境下 \b 失效；同时防止误切合法产品名中的子串
        const regex = new RegExp(`(?<![a-zA-Z])${en}(?![a-zA-Z])`, "gi");
        sanitized = sanitized.replace(regex, cn);
    }
    return sanitized;
}

/** 递归清理 faceAnalysis.labAnalysis 中的英文状态 */
function sanitizeLabAnalysis(labAnalysis: unknown): unknown {
    if (!labAnalysis || typeof labAnalysis !== 'object') return labAnalysis;
    if (Array.isArray(labAnalysis)) {
        return labAnalysis.map(sanitizeLabAnalysis);
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(labAnalysis)) {
        if (key === 'status' && typeof value === 'string') {
            result[key] = sanitizeLabStatus(value);
        } else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeLabAnalysis(value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

/**
 * 检查指定 session 是否已成功完成面部分析（AI 视觉调用已真实扣费/存储）。
 * 用于防止综合 analyze 回滚时退还已被 face-analyze 消耗的额度。
 */
async function hasSuccessfulFaceAnalysis(sessionId: string): Promise<boolean> {
    try {
        const count = await prisma.aIUsageLog.count({
            where: {
                sessionId,
                requestType: "vision",
                success: true,
            },
        });
        return count > 0;
    } catch (e) {
        logger.warn(`[analyze] Failed to check face analysis usage for ${sessionId}:`, e);
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

export async function POST(request: NextRequest) {
    // 创建 AbortController 用于服务端超时和客户端断开取消 AI 请求
    const abortController = new AbortController();
    const serverTimeout = setTimeout(() => abortController.abort(), 90 * 1000);

    const onClientAbort = () => {
        clearTimeout(serverTimeout);
        abortController.abort();
    };
    request.signal.addEventListener('abort', onClientAbort);

    // 在 try 外声明，供 catch 中清理 session 状态使用。
    // 默认空字符串仅用于避免 TS 2454；真正使用时会在下面重新赋值为有效 sessionId。
    let effectiveSessionId = "";

    try {
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

        const { answers, faceAnalysis, sessionId, nickname, freeRetry, clientDate, privacyConsent, skinState } = result.data;

        // 提取客户端标识（用于会话归属与审计）
        const identifiers = extractGuestIdentifiers(request, body as Record<string, unknown>);
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

        // 4. 检查使用限制 (Guest/Member)
        // 提前获取用户会话，避免 freeRetry 路径中重复调用 getSessionUser()
        const user = await getSessionUser(request);

        // freeRetry 有效性标记：外部仅做快速预筛（session 存在 + 已完成），
        // ownership 验证与 freeRetryUsed 原子性检查一并移入 DB 行锁事务内，消除 TOCTOU 窗口。
        let isFreeRetryAllowed = false;
        let freeRetryExistingResult: Record<string, unknown> | null = null;
        if (freeRetry && sessionId) {
            // Quick filter: reject obviously invalid requests before acquiring row lock.
            // Ownership verification is deferred to the DB transaction (lockResult) for atomicity.
            const existingSession = await prisma.advisorSession.findUnique({
                where: { sessionId },
                select: { completedAt: true, analysisResult: true }
            });
            if (!existingSession?.completedAt || !existingSession?.analysisResult) {
                return apiError(ErrorCode.FORBIDDEN, "免费重试无效：请重新进行测试", 403);
            }
            // 缓存已有的 analysisResult，避免事务内重复查询
            freeRetryExistingResult = existingSession.analysisResult as Record<string, unknown>;
            if (freeRetryExistingResult?.freeRetryUsed) {
                // 快速路径：已使用过免费重试，无需进入事务
                return apiError(ErrorCode.RATE_LIMITED, "免费重试已使用，每个会话仅限一次", 429);
            }
            isFreeRetryAllowed = true;
        }

        if (!isFreeRetryAllowed) {
            // 清理僵尸会话：超过阈值仍未完成的 analysis（服务器崩溃、网络中断等）
            // 不清除则这些会话的 analysisStartedAt 会持续占用配额。
            // 阈值 4 分钟 > 最坏耗时（队列等待 60s + face 65s + LLM 90s），避免误杀在途分析。
            // 注意：游客时 user?.id 为 undefined，Prisma 会忽略 undefined 字段导致退化为全表清理；
            // 游客会话需按 userId: null + IP 哈希匹配。
            const staleBefore = new Date(Date.now() - 4 * 60 * 1000);
            await prisma.advisorSession.updateMany({
                where: user
                    ? { userId: user.id, analysisStartedAt: { lt: staleBefore }, completedAt: null }
                    : { userId: null, ip: ipHash, analysisStartedAt: { lt: staleBefore }, completedAt: null },
                data: { analysisStartedAt: null },
            });

            const usageLimit = await checkUsageLimit(request, body as Record<string, unknown>);
            if (!usageLimit.canTest) {
                return apiError(ErrorCode.RATE_LIMITED, usageLimit.error || "您已达到今日测试上限", 429);
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
                select: { completedAt: true, analysisResult: true }
            });
            if (existingSession?.completedAt && existingSession?.analysisResult) {
                const cachedResult = existingSession.analysisResult as Record<string, unknown>;
                if (process.env.NODE_ENV !== "production") console.log(`[analyze] Returning cached result for completed session ${effectiveSessionId}`);
                return NextResponse.json(cachedResult, { status: 200, headers: rateLimitHeaders });
            }
        }

        let reservedResult: ReserveUsageResult | null = null;
        if (!isFreeRetryAllowed) {
            const reserved = await reserveUsage(request, effectiveSessionId, body as Record<string, unknown>);
            if (!reserved.success) {
                const response = apiError(ErrorCode.RATE_LIMITED, reserved.error || "您已达到今日测试上限", 429);
                Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v));
                return response;
            }
            reservedResult = reserved;
        }

        // 分布式锁：防止同一 sessionId 并发重复跑 AI
        // 使用数据库行锁 (SELECT FOR UPDATE) 保证同一时刻只有一个分析流程在执行
        const lockResult = await prisma.$transaction(async (tx) => {
            // 锁定 session 行（不存在则跳过）
            await tx.$executeRaw`SELECT * FROM "AdvisorSession" WHERE "sessionId" = ${effectiveSessionId} FOR UPDATE`;

            const session = await tx.advisorSession.findUnique({
                where: { sessionId: effectiveSessionId },
                select: { completedAt: true, analysisStartedAt: true, analysisResult: true, ip: true, userId: true }
            });

            // 再次检查是否已完成（可能刚刚完成）。免费重试需要重新跑 AI，不走缓存。
            if (!isFreeRetryAllowed && session?.completedAt && session?.analysisResult) {
                return { status: 'completed' as const, result: session.analysisResult };
            }

            // 免费重试原子性防护（ownership + freeRetryUsed 均在行锁内校验，消除 TOCTOU 窗口）：
            if (isFreeRetryAllowed) {
                // 1) 行锁内重新验证 session 有效性（防止外部预筛与事务之间的竞态）
                if (!session?.completedAt || !session?.analysisResult) {
                    return { status: 'free_retry_invalid' as const };
                }
                // 2) Ownership verification under row lock
                const currentIpHash = hashIP(ip);
                if (user?.id) {
                    if (session.userId !== user.id) {
                        return { status: 'free_retry_invalid' as const };
                    }
                } else {
                    if (session.ip && session.ip !== currentIpHash) {
                        return { status: 'free_retry_invalid' as const };
                    }
                }
                // 3) 行锁内再次检查 freeRetryUsed 标记（双重检查，防御并发）
                const existingResult = session.analysisResult as Record<string, unknown>;
                if (existingResult?.freeRetryUsed) {
                    return { status: 'free_retry_used' as const };
                }
            }

            // 若已有其他请求正在分析，返回 analyzing 状态，让客户端轮询
            if (session?.analysisStartedAt && !session?.completedAt) {
                return { status: 'analyzing' as const };
            }

            // 保存会话占位记录（标记分析开始，不设置 completedAt——防止超时后状态不一致）
            // 同时保存问卷答案，用于历史审计与复购分析
            const consentFields = privacyConsent ? {
                privacyConsentAt: new Date(privacyConsent.consentedAt),
                privacyConsentVersion: privacyConsent.version
            } : {};
            await tx.advisorSession.upsert({
                where: { sessionId: effectiveSessionId },
                update: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    answers: answers as any,
                    analysisSource: faceAnalysis ? "hybrid" : "text",
                    faceScanUsed: !!faceAnalysis,
                    analysisStartedAt: new Date(),
                    // 保留已有的 completedAt（如 freeRetry 的原始会话）
                    // Save Geo Info
                    province: geoLocation?.region,
                    city: geoLocation?.city,
                    ip: hashIP(ip),
                    userId: user?.id || null,
                    ...consentFields
                },
                create: {
                    sessionId: effectiveSessionId,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    answers: answers as any,
                    analysisSource: faceAnalysis ? "hybrid" : "text",
                    faceScanUsed: !!faceAnalysis,
                    analysisStartedAt: new Date(),
                    province: geoLocation?.region,
                    city: geoLocation?.city,
                    ip: hashIP(ip),
                    userId: user?.id || null,
                    ...consentFields
                }
            });

            return { status: 'started' as const };
        });

        if (lockResult.status === 'completed') {
            const cachedResult = lockResult.result as Record<string, unknown>;
            // 返回缓存时退还本次预占：仅当本请求实际新增了计数时才回滚
            //（P2002 幂等命中时 alreadyReserved=true，回滚会误删其他请求的预占）
            if (reservedResult && !reservedResult.alreadyReserved) {
                await rollbackUsage(request, effectiveSessionId, body as Record<string, unknown>);
            }
            console.log(`[analyze] Returning cached result after lock for session ${effectiveSessionId}`);
            return NextResponse.json(cachedResult, { status: 200, headers: rateLimitHeaders });
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
                { status: "analyzing", sessionId: effectiveSessionId, message: "分析正在进行中，请稍候" },
                { status: 202, headers: rateLimitHeaders }
            );
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
        // Determine persona via matchCharacterIP (8-pie system)
        const personaKey = matchCharacterIP({
            score: faceAnalysis?.overallScore ?? 0,
            skinType: finalSkinType,
            budget: answers.budget,
            skincareFrequency: answers.skincareFrequency,
        }).key;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const candidateProducts = await getCandidateProducts(enrichedAnswers as any, concerns, 6, personaKey, envContext);

        const concernLabels = concerns.map(c => getConcernLabel(c));

        const userPrompt = buildTextAnalysisPrompt({
            skinTypeLabel,
            ageRange: answers.ageRange,
            concerns: concernLabels,
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
            allergies: (answers as any).allergies,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pregnancyStatus: (answers as any).pregnancyStatus,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            medicationHistory: (answers as any).medicationHistory,
            isLoggedIn: !!user,
            faceAnalysis: faceAnalysis ? {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                skinType: faceAnalysis.skinType as any,
                dimensions: faceAnalysis.dimensions,
                overallScore: faceAnalysis.overallScore,
                summary: faceAnalysis.summary,
                zoneAnalysis: faceAnalysis.zoneAnalysis,
                skinAge: faceAnalysis.skinAge,
            } as Partial<FaceAnalysisResult> : undefined,
            products: candidateProducts,
            skinState
        });

        const systemPrompt = user
            ? TEXT_ANALYSIS_SYSTEM_PROMPT + '\n\n' + REGISTERED_USER_DEEP_ANALYSIS_INSTRUCTION
            : TEXT_ANALYSIS_SYSTEM_PROMPT;

        // 调用 AI
        const provider = process.env.AI_PROVIDER || "qwen";

        let resultJson: Record<string, unknown> = {};
        let queueAcquired = false;
        try {
            // P3: 请求队列处理 - 申请令牌（防止并发过高打爆 LLM API）
            // 透传 userId 使队列的 maxConcurrentPerUser 生效
            await analysisQueue.acquire({ signal: abortController.signal, userId: user?.id });
            queueAcquired = true;

            // 记录队列状态到响应头
            const queueStats = analysisQueue.getStats();
            rateLimitHeaders["X-Queue-Position"] = String(queueStats.queueLength);
            rateLimitHeaders["X-Queue-Wait-Seconds"] = String(queueStats.estimatedWaitSeconds);

            // 排队期间客户端可能已断开
            if (abortController.signal.aborted) {
                throw new Error("Request cancelled during queue wait.");
            }

            // 熔断器检查
            const textServiceKey = `text-${provider}`;
            if (!circuitBreaker.allowRequest(textServiceKey)) {
                throw new Error(`[CircuitBreaker] Text AI service ${provider} is temporarily unavailable`);
            }

            const resultText = await generateText(systemPrompt, userPrompt, provider as AIProvider, abortController.signal, user?.id, effectiveSessionId);
            resultJson = validateAndExtractJson(resultText, TextAnalysisOutputSchema) as Record<string, unknown>;
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            if (err.message?.includes("cancelled") || err.name === 'AbortError') {
                logger.warn("Text analysis cancelled (client timeout or disconnect)");
                // 仅排队等待期间取消时回滚：此时 AI 尚未被调用，零消耗
                // AI 调用进行中取消不回滚：API 可能已处理并计费
                const isQueueOnlyCancel = err.message === "Request cancelled during queue wait.";
                if (isQueueOnlyCancel) {
                    if (!(await hasSuccessfulFaceAnalysis(effectiveSessionId))) {
                        await rollbackUsage(request, effectiveSessionId, body as Record<string, unknown>);
                    }
                }
                return apiError(ErrorCode.INTERNAL_ERROR, "分析请求已取消，请重试", 499);
            }
            if (err.message?.includes("[AIBudget]")) {
                aiLogger.warn("AI budget exceeded, rejecting request", { error: err.message });
                if (!(await hasSuccessfulFaceAnalysis(effectiveSessionId))) {
                    await rollbackUsage(request, effectiveSessionId, body as Record<string, unknown>);
                }
                const response = apiError("AI_BUDGET_EXCEEDED", "服务暂不可用，请稍后重试", 503);
                response.headers.set("Retry-After", "3600");
                return response;
            }
            // 熔断器触发：直接返回 503，不走 fallback（fallback 会隐藏服务异常）
            if (err.message?.includes("[CircuitBreaker]")) {
                aiLogger.warn("Circuit breaker open, rejecting request", { error: err.message });
                if (!(await hasSuccessfulFaceAnalysis(effectiveSessionId))) {
                    await rollbackUsage(request, effectiveSessionId, body as Record<string, unknown>);
                }
                const response = apiError("AI_CIRCUIT_OPEN", "服务暂不可用，请稍后重试", 503);
                response.headers.set("Retry-After", "60");
                return response;
            }
            // 区分错误类型进行日志记录
            const errorCategory = err.message?.includes("Failed to extract valid JSON")
                ? "AI_JSON_PARSE" : err.message?.includes("401") || err.message?.includes("403")
                ? "AI_AUTH" : err.message?.includes("429")
                ? "AI_RATE_LIMIT" : err.message?.includes("timeout") || err.message?.includes("ETIMEDOUT")
                ? "AI_TIMEOUT" : "AI_UNKNOWN";
            aiLogger.warn(`AI Generation failed [${errorCategory}], falling back to rule engine`, { error: err.message });
            // 使用规则引擎生成完整降级报告，而非空对象
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fallbackFace = fallbackAnalysis(answers as any);
                resultJson = {
                    summary: fallbackFace.skinType.description || "基于您的问卷数据生成的初步分析报告。",
                    skinTypeAnalysis: `检测到的主要肤质特征为：${getSkinTypeLabel(fallbackFace.skinType.type)}。`,
                    concernAnalysis: fallbackFace.recommendations?.map((r: string) => `• ${r}`) || [],
                    lifestyleTips: fallbackFace.recommendations || [],
                    faceAnalysis: fallbackFace,
                };
            } catch (fallbackErr) {
                logger.error("Fallback analysis also failed", fallbackErr);
                resultJson = {};
            }
        } finally {
            if (queueAcquired) {
                analysisQueue.release();
            }
        }

        // 7. 补全产品详情 — 返回最多3个产品（AI精选 + 算法补足）
        let finalProducts: ProductRecommendation[] = [];

        // 预先用算法生成3个带推荐理由的候选（用于兜底和补充）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const algorithmRecs = await recommendProducts(enrichedAnswers as any, concerns, candidateProducts, 3, personaKey, envContext);

        type AiProductItem = {
            id?: string | number;
            reason?: string;
            [key: string]: unknown;
        };

        if (resultJson.products && Array.isArray(resultJson.products)) {
            const mappedProducts = (resultJson.products as AiProductItem[]).map((p) => {
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

        // 8. Construct Final Standardized Result (Matching ComprehensiveResult Interface)

        // Enhance Face Analysis with Text AI Recommendations if missing
        const finalFaceAnalysis = faceAnalysis || (resultJson.faceAnalysis as Record<string, unknown> | undefined) || null;
        if (finalFaceAnalysis) {
            const fa = finalFaceAnalysis as Record<string, unknown>;
            // 清理 labAnalysis 中的英文状态描述
            if (fa.labAnalysis) {
                fa.labAnalysis = sanitizeLabAnalysis(fa.labAnalysis);
            }
            // Ensure recommendations exist
            if (!fa.recommendations) {
                fa.recommendations = [];
            }

            // Preserve gender if available in original input
            if (faceAnalysis?.gender && !fa.gender) {
                fa.gender = faceAnalysis.gender;
            }

            // lifestyleTips 不再混入 recommendations，保持两种内容类型的独立性
            // lifestyleTips 通过 standardizedResult.analysis.lifestyleTips 独立传递


        }

        // Safe concernAnalysis extraction with Array.isArray guard
        const concernAnalysisItems = Array.isArray(resultJson.concernAnalysis)
            ? resultJson.concernAnalysis
            : [];

        const standardizedResult = {
            skinProfile: {
                type: finalSkinType,
                typeLabel: skinTypeLabel,
                concerns: concerns,
                skinAge: faceAnalysis?.skinAge?.estimated ?? 25
            },
            analysis: {
                summary: resultJson.summary || "根据您的问卷及面部数据，我们为您生成了这份综合分析报告。",
                details: [
                    resultJson.skinTypeAnalysis || "",
                    ...concernAnalysisItems
                ].filter(Boolean),
                lifestyleTips: Array.isArray(resultJson.lifestyleTips) ? resultJson.lifestyleTips as string[] : [],
            },
            products: finalProducts,
            faceAnalysis: finalFaceAnalysis, // Ensure faceAnalysis is propagated
            dataSource: "hybrid",
            persona: personaKey,          // IP 形象 key (8-pie)
            userLocation: geoLocation,
            nickname: nickname || "护肤达人", // Include user nickname for sharing
            skinState: finalFaceAnalysis && typeof skinState === "string" ? skinState : undefined // 拍摄时肌肤状态（仅面部扫描流程有意义）
        };

        // 清理 AI 输出中的潜在危险内容（存储型 XSS 防护）
        const sanitizedResult = sanitizeAiOutput(standardizedResult) as typeof standardizedResult;

        // 9. Persist Result to DB (all users including guests)
        // effectiveSessionId 总是存在，无需条件检查
        {
            // 游客报告保留 1 小时，注册用户报告保留 3 个月（与 AI 降级路径统一）
            const GUEST_RETENTION_HOURS = 1;
            const expiresAt = user?.id
                ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                : new Date(Date.now() + GUEST_RETENTION_HOURS * 60 * 60 * 1000);

            // Persist result to DB — do NOT swallow errors (ghost analysis bug)
            try {
                await prisma.$transaction(async (tx) => {
                    // Fetch existing session first to avoid overwriting parallel data
                    const existingSession = await tx.advisorSession.findUnique({
                        where: { sessionId: effectiveSessionId },
                        select: { analysisResult: true }
                    });

                    // Merge current results with any existing data
                    const mergedResult = {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...(existingSession?.analysisResult as any || {}),
                        ...sanitizedResult,
                        ...(isFreeRetryAllowed ? { freeRetryUsed: true } : {})
                    };

                    await tx.advisorSession.upsert({
                        where: { sessionId: effectiveSessionId },
                        update: {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            analysisResult: mergedResult as any,
                            analysisSource: "hybrid",
                            completedAt: new Date(),
                            province: geoLocation?.region,
                            city: geoLocation?.city,
                            expiresAt: expiresAt,
                            // 保留已有的 answers，不覆盖问卷数据
                        },
                        create: {
                            sessionId: effectiveSessionId,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            answers: answers as any,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            analysisResult: mergedResult as any,
                            analysisSource: "hybrid",
                            completedAt: new Date(),
                            province: geoLocation?.region,
                            city: geoLocation?.city,
                            expiresAt: expiresAt,
                            ip: ipHash,
                            userId: user?.id || null,
                            userAgent: identifiers.userAgent,
                            ...parseUserAgent(identifiers.userAgent)
                        }
                    });
                });
            } catch (txErr) {
                logger.error("Failed to persist final analysis:", txErr);
                const response = apiError(ErrorCode.SERVICE_UNAVAILABLE, "分析结果保存未成功，请重试", 503, "DATABASE_PERSISTENCE_ERROR");
            Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v));
            return response;
            }

            // ====== 护肤日记自动生成：测肤完成后写入/更新当日条目 ======
            // 失败不影响分析响应；仅真实面部分析（faceAnalysis 存在）生成。
            // 不加 faceAnalysis 条件时，纯问卷测肤在 AI 失败走规则引擎降级路径
            // 会拿到默认 overallScore 75，伪装成真实测肤记录写入日记。
            const overallScore = (finalFaceAnalysis as Record<string, unknown> | null)?.overallScore;
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
            if (user?.id) {
                const score = faceAnalysis?.overallScore || 85;
                let primaryConcern = "肤色暗沉或不均";
                if (concerns && concerns.length > 0) {
                    primaryConcern = concerns.join("、");
                }

                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://advisor.nihplod.cn";
                const reportUrl = `${baseUrl}/reports/${effectiveSessionId}`;

                // 异步触发，绝不阻塞前端响应时间
                sendOfficialWechatTemplate(user.id, score, primaryConcern, reportUrl).catch((err) =>
                    aiLogger.error("[WechatTemplate] 发送函数未捕获异常", { error: String(err) })
                );
            }
        }

        return NextResponse.json(sanitizedResult, { headers: rateLimitHeaders });

    } catch (error: unknown) {
        // 清理 analysisStartedAt，避免 session 因任何异常（AI 失败、超时、取消）永久卡在 analyzing
        if (effectiveSessionId) {
            let cleanedUp = false;
            for (let attempt = 0; attempt < 3 && !cleanedUp; attempt++) {
                try {
                    await prisma.advisorSession.update({
                        where: { sessionId: effectiveSessionId },
                        data: { analysisStartedAt: null }
                    });
                    cleanedUp = true;
                } catch (cleanupErr) {
                    logger.error(`[analyze] DB cleanup attempt ${attempt + 1}/3 failed:`, cleanupErr);
                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
                    }
                }
            }
            if (!cleanedUp) {
                logger.error(`[analyze] CRITICAL: Failed to cleanup after 3 attempts, session ${effectiveSessionId} may be stuck`);
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
