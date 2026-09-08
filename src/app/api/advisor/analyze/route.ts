import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { apiError } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { generateText, fallbackAnalysis, type AIProvider } from "@/lib/ai";
import { analysisQueue } from "@/lib/ai-queue";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { validateAndExtractJson, ConsultantReportSchema, type ConsultantReport } from "@/lib/advisor-utils";
import { buildConsultantPrompt, CONSULTANT_SYSTEM_PROMPT, type PersonaRoutineContext } from "@/config/ai-prompts";
import { getSkinTypeByIpKey } from "@/lib/result-content";
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

import { checkUsageLimit, reserveUsage, rollbackUsage, GUEST_REQUIRE_LOGIN_MESSAGE, type ReserveUsageResult } from "@/lib/usage-limit";
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

        // 4. 检查使用限制 (Guest/Member)
        // 提前获取用户会话，避免 freeRetry 路径中重复调用 getSessionUser()
        const user = await getSessionUser(request);

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

        // face-analyze 已用同一 sessionId 预占额度（TestRecord 已写入）时，analyze 复用该预占：
        // 跳过限额预检与重复预占，避免把自己的预占计入已用数导致"最后一次额度"被误拒。
        // 仅当会话尚未完成时成立——已完成的会话必须走正常限额 + 缓存路径，
        // 防止用历史已完成 sessionId 的 TestRecord 绕过限额白嫖新分析。
        // 同时校验 TestRecord 归属当前登录用户：游客/他人 sessionId 不能借此绕过登录与限额。
        let hasPriorReservation = false;
        if (!isFreeRetryAllowed && sessionId && user) {
            const [priorRecord, priorSession] = await Promise.all([
                prisma.testRecord.findUnique({ where: { sessionId }, select: { userId: true } }),
                prisma.advisorSession.findUnique({ where: { sessionId }, select: { completedAt: true } }),
            ]);
            hasPriorReservation = priorRecord?.userId === user.id && !priorSession?.completedAt;
        }

        if (!isFreeRetryAllowed) {
            // 清理僵尸会话：超过阈值仍未完成的 analysis（服务器崩溃、网络中断等）
            // 不清除则这些会话的 analysisStartedAt 会持续占用配额。
            // 阈值 4 分钟 > 最坏耗时（队列等待 60s + face 65s + LLM 90s），避免误杀在途分析。
            // 游客已被下方限额预检 401 拦截，不再按 userId: null + IP 哈希清理历史游客会话。
            if (user) {
                const staleBefore = new Date(Date.now() - 4 * 60 * 1000);
                await prisma.advisorSession.updateMany({
                    where: { userId: user.id, analysisStartedAt: { lt: staleBefore }, completedAt: null },
                    data: { analysisStartedAt: null },
                });
            }

            if (!hasPriorReservation) {
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
            if (hasPriorReservation) {
                // 复用 face-analyze 的既有预占（等价 alreadyReserved）：
                // 不再重复计数，且本请求任何失败路径都不得回滚这条他人创建的预占
                reservedResult = { success: true, role: "member", alreadyReserved: true };
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
                    const response = apiError(ErrorCode.RATE_LIMITED, reserved.error || "您已达到今日测试上限", 429);
                    Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v));
                    return response;
                }
                reservedResult = reserved;
            }
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
                await rollbackUsage(request, effectiveSessionId);
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

        // 派系护肤方案骨架（result-content.json 的 m4 早晚节奏 + m7 护肤公式），
        // 注入 prompt 让 AI 在既定方案上做个性化微调，而非从零编写
        const personaContent = ((): PersonaRoutineContext | undefined => {
            const personaData = getSkinTypeByIpKey(personaKey);
            if (!personaData) return undefined;
            return {
                typeName: personaData.typeName,
                morning: personaData.m4?.morning,
                night: personaData.m4?.night,
                formulaCore: personaData.m7?.formulaCore,
                formulaSuggestions: personaData.m7?.suggestions?.map((s) => `${s.title}：${s.content}`),
            };
        })();

        const userPrompt = buildConsultantPrompt({
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                skinConditions: (faceAnalysis as any).skinConditions,
            } as Partial<FaceAnalysisResult> : undefined,
            products: candidateProducts,
            skinState,
            personaContent
        });

        // 顾问叙事报告（Report v2）：面诊口吻 + 推理链 + 证据驱动，统一由一个模型产出全部文案
        const systemPrompt = CONSULTANT_SYSTEM_PROMPT;

        // 调用 AI
        const provider = process.env.AI_PROVIDER || "qwen";

        let resultJson: Record<string, unknown> = {};
        // 顾问叙事报告（v2）解析成功时非空；fallback 规则引擎产出 v1 结构，此变量保持 null
        let consultantReport: ConsultantReport | null = null;
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
            consultantReport = validateAndExtractJson(resultText, ConsultantReportSchema);
            resultJson = consultantReport as unknown as Record<string, unknown>;
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            if (err.message?.includes("cancelled") || err.name === 'AbortError') {
                logger.warn("Text analysis cancelled (client timeout or disconnect)");
                // 仅排队等待期间取消时回滚：此时 AI 尚未被调用，零消耗
                // AI 调用进行中取消不回滚：API 可能已处理并计费
                const isQueueOnlyCancel = err.message === "Request cancelled during queue wait.";
                if (isQueueOnlyCancel) {
                    if (!(await hasSuccessfulFaceAnalysis(effectiveSessionId))) {
                        await rollbackUsage(request, effectiveSessionId);
                    }
                }
                return apiError(ErrorCode.INTERNAL_ERROR, "分析请求已取消，请重试", 499);
            }
            if (err.message?.includes("[AIBudget]")) {
                aiLogger.warn("AI budget exceeded, rejecting request", { error: err.message });
                if (!(await hasSuccessfulFaceAnalysis(effectiveSessionId))) {
                    await rollbackUsage(request, effectiveSessionId);
                }
                const response = apiError("AI_BUDGET_EXCEEDED", "服务暂不可用，请稍后重试", 503);
                response.headers.set("Retry-After", "3600");
                return response;
            }
            // 熔断器触发：直接返回 503，不走 fallback（fallback 会隐藏服务异常）
            if (err.message?.includes("[CircuitBreaker]")) {
                aiLogger.warn("Circuit breaker open, rejecting request", { error: err.message });
                if (!(await hasSuccessfulFaceAnalysis(effectiveSessionId))) {
                    await rollbackUsage(request, effectiveSessionId);
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

        if (resultJson.productReasons && Array.isArray(resultJson.productReasons)) {
            const mappedProducts = (resultJson.productReasons as AiProductItem[]).map((p) => {
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

        // Safe concernAnalysis extraction with Array.isArray guard（仅 v1 fallback 路径有此字段）
        const concernAnalysisItems = Array.isArray(resultJson.concernAnalysis)
            ? resultJson.concernAnalysis
            : [];

        // v2 顾问报告：details 由各问题的 observation 组成，供旧消费方（历史列表、日记补建）使用
        const consultantObservations = consultantReport?.issues.map((i) => i.observation) ?? [];
        const consultantLifestylePlans = consultantReport?.issues.map((i) => i.lifestylePlan) ?? [];

        const standardizedResult = {
            skinProfile: {
                type: finalSkinType,
                typeLabel: skinTypeLabel,
                concerns: concerns,
                skinAge: faceAnalysis?.skinAge?.estimated ?? 25
            },
            analysis: {
                summary: consultantReport?.overview || (resultJson.summary as string | undefined) || "根据您的问卷及面部数据，我们为您生成了这份综合分析报告。",
                details: consultantReport
                    ? consultantObservations
                    : [
                        resultJson.skinTypeAnalysis || "",
                        ...concernAnalysisItems
                    ].filter(Boolean),
                lifestyleTips: consultantReport
                    ? consultantLifestylePlans
                    : (Array.isArray(resultJson.lifestyleTips) ? resultJson.lifestyleTips as string[] : []),
            },
            products: finalProducts,
            faceAnalysis: finalFaceAnalysis, // Ensure faceAnalysis is propagated
            dataSource: "hybrid",
            persona: personaKey,          // IP 形象 key (8-pie)
            userLocation: geoLocation,
            nickname: nickname || "护肤达人", // Include user nickname for sharing
            skinState: finalFaceAnalysis && typeof skinState === "string" ? skinState : undefined, // 拍摄时肌肤状态（仅面部扫描流程有意义）
            // 顾问叙事报告标记与数据（v2）；fallback 路径不携带，前端走旧渲染
            ...(consultantReport ? { reportVersion: 2, consultantReport } : {}),
        };

        // 清理 AI 输出中的潜在危险内容（存储型 XSS 防护）
        const sanitizedResult = sanitizeAiOutput(standardizedResult) as typeof standardizedResult;

        // 9. Persist Result to DB (all users including guests)
        // effectiveSessionId 总是存在，无需条件检查
        {
            // 报告保留 90 天（游客已被前置 401 拦截，此处仅登录用户可达；TS 兜底同样按 90 天）
            const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

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
                            userAgent,
                            ...parseUserAgent(userAgent)
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
