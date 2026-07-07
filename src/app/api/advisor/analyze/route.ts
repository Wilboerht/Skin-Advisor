import { NextRequest, NextResponse } from "next/server";
import { generateText, isAIEnabled, fallbackAnalysis, type AIProvider } from "@/lib/ai";
import { analysisQueue } from "@/lib/ai-queue";
import { circuitBreaker } from "@/lib/circuit-breaker";
import { extractJsonFromResponse } from "@/lib/advisor-utils";
import { buildTextAnalysisPrompt, TEXT_ANALYSIS_SYSTEM_PROMPT } from "@/config/ai-prompts";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import prisma from "@/lib/prisma";
import { getSkinTypeLabel, getConcernLabel } from "@/lib/advisor-utils";
// import { PRODUCTS_CATALOG } from "@/config/products"; // Deprecated, use DB or matchProducts
import { determineSkinType, identifyConcerns } from "@/lib/advisor-utils";
import { AnalyzeRequestSchema } from "@/lib/schemas";
import { recommendProducts, getCandidateProducts, type ProductRecommendation } from "@/lib/recommendations";
import { resolveIPLocation } from "@/lib/geoip";
import { getSession } from "@/lib/auth";
import { hashIP } from "@/lib/privacy";
import { matchCharacterIP } from "@/lib/result-utils";

import { checkUsageLimit, reserveUsage, rollbackUsage } from "@/lib/usage-limit";
import { extractGuestIdentifiers } from "@/lib/guest-limit";
import { aiLogger } from "@/lib/logger";
import { createSignedInternalApiHeaders } from "@/lib/internal-api";
import DOMPurify from 'isomorphic-dompurify';

const WECHAT_TEMPLATE_CIRCUIT_KEY = "official-wechat-template";
const WECHAT_TEMPLATE_MAX_RETRIES = 3;
const WECHAT_TEMPLATE_TIMEOUT_MS = 15000;

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

/** 从服务端 User-Agent 解析设备信息 */
function parseDeviceInfo(userAgent: string | null) {
    if (!userAgent) return { deviceType: null as string | null, browser: null as string | null, os: null as string | null };
    const ua = userAgent.toLowerCase();
    let deviceType: string | null = 'desktop';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        deviceType = 'tablet';
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(userAgent)) {
        deviceType = 'mobile';
    }

    let browser: string | null = 'unknown';
    if (userAgent.includes('Firefox')) browser = 'firefox';
    else if (userAgent.includes('Edg')) browser = 'edge';
    else if (userAgent.includes('Chrome')) browser = 'chrome';
    else if (userAgent.includes('Safari')) browser = 'safari';

    let os: string | null = 'unknown';
    if (userAgent.includes('Win')) os = 'windows';
    else if (userAgent.includes('Mac')) os = 'macos';
    else if (userAgent.includes('Linux')) os = 'linux';
    else if (userAgent.includes('Android')) os = 'android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'ios';

    return { deviceType, browser, os };
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
        const regex = new RegExp(`\\b${en}\\b`, "gi");
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
        const regex = new RegExp(`\\b${en}\\b`, "gi");
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
            return NextResponse.json(
                { error: "无效的请求体，请检查 JSON 格式" },
                { status: 400 }
            );
        }

        // 2. 使用 Zod 验证（先验证再扣额度，避免无效请求浪费配额）
        const result = AnalyzeRequestSchema.safeParse(body);
        if (!result.success) {
            console.error("Analyze validation error:", JSON.stringify(result.error.flatten(), null, 2));
            return NextResponse.json(
                {
                    error: "请求参数错误",
                    details: result.error.flatten().fieldErrors
                },
                { status: 400 }
            );
        }

        const { answers, faceAnalysis, sessionId, nickname, freeRetry, privacyConsent } = result.data;

        // 提取客户端标识（用于会话归属与审计）
        const identifiers = extractGuestIdentifiers(request, body as Record<string, unknown>);
        const ipHash = hashIP(getClientIP(request));

        // 3. 速率限制 (基础防刷) — 即使免费重试也需要基础限流
        const ip = getClientIP(request);
        const limit = await rateLimit(`advisor-analyze-${ip}`, "comprehensive-analyze", { maxRequests: 20 });

        const geoLocation = resolveIPLocation(ip);
        const rateLimitHeaders: Record<string, string> = {
            "X-RateLimit-Limit": String(limit.limit),
            "X-RateLimit-Remaining": String(limit.remaining),
            "X-RateLimit-Reset": String(limit.reset)
        };

        if (!limit.success) {
            return NextResponse.json(
                { error: "请求过于频繁，请稍后再试" },
                { status: 429, headers: rateLimitHeaders }
            );
        }

        // 4. 检查使用限制 (Guest/Member)
        // freeRetry 有效性标记：仅验证 session 存在性与所有权（读操作，无竞态）。
        // freeRetryUsed 标记的原子性检查移入 DB 行锁事务内，防止并发绕过。
        let isFreeRetryAllowed = false;
        if (freeRetry && sessionId) {
            // Validate freeRetry eligibility: session must have a prior completed analysis.
            // CRITICAL: Also verify session ownership to prevent sessionId enumeration attacks.
            const existingSession = await prisma.advisorSession.findUnique({
                where: { sessionId },
                select: { completedAt: true, analysisResult: true, ip: true, userId: true }
            });
            if (!existingSession?.completedAt || !existingSession?.analysisResult) {
                return NextResponse.json(
                    { error: "免费重试无效：尚未完成过首次分析" },
                    { status: 400 }
                );
            }
            // Ownership verification: current requester must match session creator
            const currentUser = await getSession();
            const currentIpHash = hashIP(ip);
            if (currentUser?.id) {
                if (existingSession.userId !== currentUser.id) {
                    return NextResponse.json(
                        { error: "免费重试无效：无权访问此会话" },
                        { status: 403 }
                    );
                }
            } else {
                if (existingSession.ip && existingSession.ip !== currentIpHash) {
                    return NextResponse.json(
                        { error: "免费重试无效：会话身份验证失败" },
                        { status: 403 }
                    );
                }
            }
            // freeRetryUsed 原子性检查推迟到 DB 行锁事务内（见下方 lockResult）
            isFreeRetryAllowed = true;
        }

        if (!isFreeRetryAllowed) {
            const usageLimit = await checkUsageLimit(request, body as Record<string, unknown>);
            if (!usageLimit.canTest) {
                return NextResponse.json(
                    { error: usageLimit.error || "您已达到今日测试上限" },
                    { status: 429 }
                );
            }
        }

        // 注入地理位置 (如果用户未提供)
        if (!answers.location && geoLocation) {
            answers.location = `${geoLocation.region || ''} ${geoLocation.city || ''}`.trim();
        }

        // 6. 检查用户登录状态
        const user = await getSession();

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
                console.log(`[analyze] Returning cached result for completed session ${effectiveSessionId}`);
                return NextResponse.json(cachedResult, { status: 200, headers: rateLimitHeaders });
            }
        }

        if (!isFreeRetryAllowed) {
            const reserved = await reserveUsage(request, effectiveSessionId, body as Record<string, unknown>);
            if (!reserved.success) {
                return NextResponse.json(
                    { error: reserved.error || "您已达到今日测试上限" },
                    { status: 429, headers: rateLimitHeaders }
                );
            }
        }

        // 分布式锁：防止同一 sessionId 并发重复跑 AI
        // 使用数据库行锁 (SELECT FOR UPDATE) 保证同一时刻只有一个分析流程在执行
        const lockResult = await prisma.$transaction(async (tx) => {
            // 锁定 session 行（不存在则跳过）
            await tx.$executeRaw`SELECT * FROM "AdvisorSession" WHERE "sessionId" = ${effectiveSessionId} FOR UPDATE`;

            const session = await tx.advisorSession.findUnique({
                where: { sessionId: effectiveSessionId },
                select: { completedAt: true, analysisStartedAt: true, analysisResult: true }
            });

            // 再次检查是否已完成（可能刚刚完成）。免费重试需要重新跑 AI，不走缓存。
            if (!isFreeRetryAllowed && session?.completedAt && session?.analysisResult) {
                return { status: 'completed' as const, result: session.analysisResult };
            }

            // 免费重试原子性防护：在行锁内再次检查 freeRetryUsed 标记，
            // 防止并发请求同时通过预检查后在 DB 层绕过。
            if (isFreeRetryAllowed && session?.analysisResult) {
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
            console.log(`[analyze] Returning cached result after lock for session ${effectiveSessionId}`);
            return NextResponse.json(cachedResult, { status: 200, headers: rateLimitHeaders });
        }

        if (lockResult.status === 'free_retry_used') {
            return NextResponse.json(
                { error: "免费重试已使用，每个会话仅限一次" },
                { status: 429, headers: rateLimitHeaders }
            );
        }

        if (lockResult.status === 'analyzing') {
            return NextResponse.json(
                { status: "analyzing", sessionId: effectiveSessionId, message: "分析正在进行中，请稍候" },
                { status: 202, headers: rateLimitHeaders }
            );
        }

        // 5. 检查 AI 开关
        const aiEnabled = await isAIEnabled();

        if (!aiEnabled) {
            // 降级模式：使用规则引擎生成面部分析数据
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fallbackFace = fallbackAnalysis(answers as any);

            // 补全产品推荐 (DB) — 与正式 AI 路径一致：先走 IP 匹配 + 候选池
            const fallbackSkinType = fallbackFace.skinType.type;
            const enrichedAnswers = { ...answers, skinType: fallbackSkinType };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const concerns = identifyConcerns(enrichedAnswers as any, fallbackFace);
            const personaKey = matchCharacterIP({
                score: fallbackFace.overallScore ?? 0,
                skinType: fallbackSkinType,
                budget: answers.budget,
                skincareFrequency: answers.skincareFrequency,
            }).key;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const candidateProducts = await getCandidateProducts(enrichedAnswers as any, concerns, 3, personaKey);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const products = await recommendProducts(enrichedAnswers as any, concerns, candidateProducts, 3, personaKey);

            // 构造符合 ComprehensiveResult 结构的数据
            const finalResult = {
                skinProfile: {
                    type: fallbackFace.skinType.type,
                    typeLabel: getSkinTypeLabel(fallbackFace.skinType.type),
                    concerns: concerns,
                    skinAge: 25
                },
                analysis: {
                    summary: fallbackFace.skinType.description || "基于您的问卷数据生成的初步分析报告。",
                    details: [
                        "由于 AI 服务暂时不可用，本报告基于您的问卷回答生成。",
                        `检测到的主要肤质特征为：${getSkinTypeLabel(fallbackFace.skinType.type)}。`,
                        ...fallbackFace.recommendations
                    ]
                },
                products: products,
                dataSource: "questionnaire" as const,
                persona: personaKey,
                userLocation: geoLocation,
                nickname: nickname || "护肤达人"
            };

            // 持久化降级结果（effectiveSessionId 总是存在）
            // 游客统一 1 小时，与 hybrid 路径一致
            {
                const GUEST_RETENTION_HOURS = 1;
                const expiresAt = user?.id
                    ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                    : new Date(Date.now() + GUEST_RETENTION_HOURS * 60 * 60 * 1000);
                try {
                    await prisma.advisorSession.upsert({
                        where: { sessionId: effectiveSessionId },
                        update: {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            analysisResult: finalResult as any,
                            analysisSource: "fallback",
                            completedAt: new Date(),
                            expiresAt
                            // answers 已在前面保存，此处不覆盖
                        },
                        create: {
                            sessionId: effectiveSessionId,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            answers: answers as any,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            analysisResult: finalResult as any,
                            analysisSource: "fallback",
                            completedAt: new Date(),
                            expiresAt
                        }
                    });
                } catch (persistErr) {
                    console.error("[AI-Disabled] Failed to persist fallback result:", persistErr);
                }
            }

            return NextResponse.json(finalResult, { headers: rateLimitHeaders });
        }

        // 6. 构建 AI 提示词与调用
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
        const candidateProducts = await getCandidateProducts(enrichedAnswers as any, concerns, 3, personaKey);

        const concernLabels = concerns.map(c => getConcernLabel(c));

        const userPrompt = buildTextAnalysisPrompt({
            skinTypeLabel,
            ageRange: answers.ageRange,
            concerns: concernLabels,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            medicalBeauty: (answers as any).medicalBeauty,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sleep: (answers as any).sleepQuality,
            faceAnalysis: faceAnalysis ? {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                skinType: faceAnalysis.skinType as any,
                dimensions: faceAnalysis.dimensions,
                overallScore: faceAnalysis.overallScore
            } : undefined,
            products: candidateProducts
        });

        const systemPrompt = TEXT_ANALYSIS_SYSTEM_PROMPT;

        // 调用 AI
        const provider = process.env.AI_PROVIDER || "qwen";

        let resultJson: Record<string, unknown> = {};
        let queueAcquired = false;
        try {
            // P3: 请求队列处理 - 申请令牌（防止并发过高打爆 LLM API）
            await analysisQueue.acquire({ signal: abortController.signal });
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

            const resultText = await generateText(systemPrompt, userPrompt, provider as AIProvider, abortController.signal, user?.id);
            resultJson = extractJsonFromResponse<Record<string, unknown>>(resultText);
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            if (err.message?.includes("cancelled") || err.name === 'AbortError') {
                console.warn("Text analysis cancelled (client timeout or disconnect)");
                // 仅排队等待期间取消时回滚：此时 AI 尚未被调用，零消耗
                // AI 调用进行中取消不回滚：API 可能已处理并计费
                const isQueueOnlyCancel = err.message === "Request cancelled during queue wait.";
                if (isQueueOnlyCancel) {
                    await rollbackUsage(request, effectiveSessionId, body as Record<string, unknown>);
                }
                return NextResponse.json(
                    { error: "分析请求已取消，请重试" },
                    { status: 499 }
                );
            }
            // 预算熔断：直接拒绝请求，不走 fallback（避免隐藏费用问题）
            if (err.message?.includes("[AIBudget]")) {
                aiLogger.warn("AI budget exceeded, rejecting request", { error: err.message });
                await rollbackUsage(request, effectiveSessionId, body as Record<string, unknown>);
                return NextResponse.json(
                    { error: "AI 服务当前额度已用完，请稍后再试", code: "AI_BUDGET_EXCEEDED" },
                    { status: 503, headers: { "Retry-After": "3600" } }
                );
            }
            console.error("AI Generation failed, falling back to rule engine", err);
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
                console.error("Fallback analysis also failed", fallbackErr);
                resultJson = {};
            }
        } finally {
            if (queueAcquired) {
                analysisQueue.release();
            }
        }

        // 7. 补全产品详情 — 返回最多10个产品，前3个为AI精选推荐
        let finalProducts: ProductRecommendation[] = [];

        // 预先用算法生成10个带推荐理由的候选（用于兜底和补充）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const algorithmRecs = await recommendProducts(enrichedAnswers as any, concerns, candidateProducts, 3, personaKey);

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

            // If recommendations are empty or we have better ones from text analysis
            if (resultJson.lifestyleTips && Array.isArray(resultJson.lifestyleTips)) {
                const recommendations = fa.recommendations as unknown[];
                // Clean up duplicates if any
                const newRecs = (resultJson.lifestyleTips as string[]).filter((tip: string) =>
                    !recommendations.includes(tip)
                );
                fa.recommendations = [...recommendations, ...newRecs];
            }


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
            nickname: nickname || "护肤达人" // Include user nickname for sharing
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
                            ...parseDeviceInfo(identifiers.userAgent)
                        }
                    });
                });
            } catch (txErr) {
                console.error("Failed to persist final analysis:", txErr);
                return NextResponse.json(
                    { error: "分析结果保存失败，请重试", details: "DATABASE_PERSISTENCE_ERROR" },
                    { status: 503, headers: rateLimitHeaders }
                );
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
            try {
                await prisma.advisorSession.update({
                    where: { sessionId: effectiveSessionId },
                    data: { analysisStartedAt: null }
                });
            } catch (cleanupErr) {
                console.error("[analyze] Failed to cleanup analysisStartedAt:", cleanupErr);
            }
        }

        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message?.includes("cancelled") || (err as { name?: string }).name === 'AbortError') {
            return NextResponse.json(
                { error: "分析请求已取消，请重试" },
                { status: 499 }
            );
        }
        // 使用脱敏 logger，避免 error 对象中携带请求上下文/URL 等敏感信息
        aiLogger.error("Advisor analysis failed", {
            errorMessage: err.message,
            errorName: err.name,
            sessionId: effectiveSessionId || undefined,
        });
        return NextResponse.json(
            { error: "生成分析报告失败，请重试" },
            { status: 500 }
        );
    } finally {
        clearTimeout(serverTimeout);
        request.signal.removeEventListener('abort', onClientAbort);
    }
}
