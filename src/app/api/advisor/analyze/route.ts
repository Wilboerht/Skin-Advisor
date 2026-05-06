import { NextRequest, NextResponse } from "next/server";
import { generateText, isAIEnabled, fallbackAnalysis } from "@/lib/ai";
import { analysisQueue } from "@/lib/ai-queue";
import { extractJsonFromResponse } from "@/lib/advisor-utils";
import { buildTextAnalysisPrompt, TEXT_ANALYSIS_SYSTEM_PROMPT } from "@/config/ai-prompts";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSkinTypeLabel, getConcernLabel } from "@/lib/advisor-utils";
// import { PRODUCTS_CATALOG } from "@/config/products"; // Deprecated, use DB or matchProducts
import { determineSkinType, identifyConcerns } from "@/lib/advisor-utils";
import { AnalyzeRequestSchema } from "@/lib/schemas";
import { recommendProducts, getCandidateProducts } from "@/lib/recommendations";
import { resolveIPLocation } from "@/lib/geoip";
import { getSession } from "@/lib/auth";
import { hashIP } from "@/lib/privacy";

import { checkUsageLimit, recordUsage } from "@/lib/usage-limit";
import { sendSkinReportTemplateMessage } from "@/lib/wechat";

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

export async function POST(request: NextRequest) {
    // 创建 AbortController 用于服务端超时和客户端断开取消 AI 请求
    const abortController = new AbortController();
    const serverTimeout = setTimeout(() => abortController.abort(), 90 * 1000);

    const onClientAbort = () => {
        clearTimeout(serverTimeout);
        abortController.abort();
    };
    request.signal.addEventListener('abort', onClientAbort);

    try {
        // 1. 解析请求体
        const body = await request.json();

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

        const { answers, faceAnalysis, sessionId, nickname, freeRetry } = result.data;

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

        // 4. 检查使用限制 (Guest/Member/VIP)
        let isFreeRetryAllowed = false;
        if (freeRetry && sessionId) {
            // Validate freeRetry eligibility server-side:
            // Only allowed if the session has a prior completed analysis and hasn't used freeRetry before.
            const existingSession = await prisma.advisorSession.findUnique({
                where: { sessionId },
                select: { completedAt: true, analysisResult: true }
            });
            const priorResult = existingSession?.analysisResult as Record<string, unknown> | null;
            if (!existingSession?.completedAt || !existingSession?.analysisResult) {
                return NextResponse.json(
                    { error: "免费重试无效：尚未完成过首次分析" },
                    { status: 400 }
                );
            }
            if (priorResult?.freeRetryUsed) {
                return NextResponse.json(
                    { error: "免费重试已使用，每个会话仅限一次" },
                    { status: 429 }
                );
            }
            isFreeRetryAllowed = true;
        }

        if (!isFreeRetryAllowed) {
            const usageLimit = await checkUsageLimit(request, body);
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

        // 保存会话占位记录（标记分析开始，不设置 completedAt——防止超时后状态不一致）
        // 注意：原始问卷数据(answers)不入库，报告生成后仅存分析结果
        if (sessionId) {
            await prisma.advisorSession.upsert({
                where: { sessionId },
                update: {
                    analysisSource: faceAnalysis ? "hybrid" : "text",
                    faceScanUsed: !!faceAnalysis,
                    analysisStartedAt: new Date(),
                    // 保留已有的 completedAt（如 freeRetry 的原始会话）
                    // Save Geo Info
                    province: geoLocation?.region,
                    city: geoLocation?.city,
                    ip: hashIP(ip),
                    userId: user?.id || null
                },
                create: {
                    sessionId,
                    analysisSource: faceAnalysis ? "hybrid" : "text",
                    faceScanUsed: !!faceAnalysis,
                    analysisStartedAt: new Date(),
                    province: geoLocation?.region,
                    city: geoLocation?.city,
                    ip: hashIP(ip),
                    userId: user?.id || null
                }
            }).catch((err: unknown) => console.error("Session save error:", err));
        }

        // 5. 检查 AI 开关
        const aiEnabled = await isAIEnabled();

        if (!aiEnabled) {
            console.log("AI Disabled, using fallback analysis");
            // 降级模式：使用规则引擎生成面部分析数据
            const fallbackFace = fallbackAnalysis(answers as any);

            // 补全产品推荐 (DB)
            const fallbackSkinType = fallbackFace.skinType.type;
            const enrichedAnswers = { ...answers, skinType: fallbackSkinType };
            const concerns = identifyConcerns(enrichedAnswers as any, fallbackFace);
            const products = await recommendProducts(enrichedAnswers as any, concerns);

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
                faceAnalysis: fallbackFace,
                products: products,
                dataSource: "questionnaire" as const,
                userLocation: geoLocation,
                nickname: nickname || "护肤达人"
            };

            return NextResponse.json(finalResult, { headers: rateLimitHeaders });
        }

        // 6. 构建 AI 提示词与调用
        // Resolve Skin Type (Priority: Face Analysis > User Answer)
        const finalSkinType = determineSkinType(answers, (faceAnalysis as any) || undefined);
        const skinTypeLabel = getSkinTypeLabel(finalSkinType);
        const enrichedAnswers = { ...answers, skinType: finalSkinType };

        // FETCH PRODUCTS (Candidate Selection / RAG Lite)
        const concerns = identifyConcerns(enrichedAnswers as any, faceAnalysis as any); // Pre-calculate concerns
        const candidateProducts = await getCandidateProducts(enrichedAnswers as any, concerns, 10); // Top 10

        const concernLabels = concerns.map(c => getConcernLabel(c));

        const userPrompt = buildTextAnalysisPrompt({
            skinTypeLabel,
            ageRange: answers.ageRange,
            concerns: concernLabels,
            medicalBeauty: (answers as any).medicalBeauty,
            sleep: (answers as any).sleepQuality,
            faceAnalysis: faceAnalysis ? {
                skinType: faceAnalysis.skinType as any,
                dimensions: faceAnalysis.dimensions,
                overallScore: faceAnalysis.overallScore
            } : undefined,
            products: candidateProducts
        });

        const systemPrompt = TEXT_ANALYSIS_SYSTEM_PROMPT;

        // 调用 AI
        const provider = process.env.AI_PROVIDER || "openai";
        console.log(`Starting text analysis with ${provider}...`);

        let resultJson: any;
        let queueAcquired = false;
        try {
            // P3: 请求队列处理 - 申请令牌（防止并发过高打爆 LLM API）
            await analysisQueue.acquire();
            queueAcquired = true;

            // 记录队列状态到响应头
            const queueStats = analysisQueue.getStats();
            rateLimitHeaders["X-Queue-Position"] = String(queueStats.queueLength);
            rateLimitHeaders["X-Queue-Wait-Seconds"] = String(queueStats.estimatedWaitSeconds);

            // 排队期间客户端可能已断开
            if (abortController.signal.aborted) {
                throw new Error("Request cancelled during queue wait.");
            }

            const resultText = await generateText(systemPrompt, userPrompt, provider as any, abortController.signal);
            resultJson = extractJsonFromResponse<any>(resultText);
        } catch (e: any) {
            if (e.message?.includes("cancelled") || e.name === 'AbortError') {
                console.warn("Text analysis cancelled (client timeout or disconnect)");
                return NextResponse.json(
                    { error: "分析请求已取消，请重试" },
                    { status: 499 }
                );
            }
            console.error("AI Generation failed, falling back", e);
            // Fallback if AI text gen fails but we have DB
            resultJson = {};
        } finally {
            if (queueAcquired) {
                analysisQueue.release();
            }
        }

        if (!resultJson) {
            resultJson = {}; // Safety
        }

        // 7. 补全产品详情 — 返回最多10个产品，前3个为AI精选推荐
        let finalProducts: any[] = [];

        // 预先用算法生成10个带推荐理由的候选（用于兜底和补充）
        const algorithmRecs = await recommendProducts(enrichedAnswers as any, concerns, candidateProducts, 10);

        if (resultJson.products && Array.isArray(resultJson.products)) {
            const mappedProducts = resultJson.products.map((p: any) => {
                // strict match against candidate pool to enforce RAG boundaries
                const catalogProduct = candidateProducts.find((cp: any) => String(cp.id) === String(p.id));
                if (catalogProduct) {
                    return {
                        ...p,
                        id: catalogProduct.id,
                        name: catalogProduct.name,
                        nameEn: catalogProduct.nameEn,
                        category: catalogProduct.category,
                        image: catalogProduct.image,
                        price: catalogProduct.price,
                        description: catalogProduct.description,
                        keyIngredients: catalogProduct.keyIngredients || [],
                        benefits: catalogProduct.benefits || [],
                        affiliateLinks: catalogProduct.affiliateLinks || null,
                        howToUse: catalogProduct.howToUse || null,
                        reason: sanitizeReason(p.reason || algorithmRecs.find((r: any) => r.id === p.id)?.reason || "为您精选的护肤产品")
                    };
                }
                return null;
            }).filter(Boolean);

            if (mappedProducts.length > 0) {
                // 前3个为AI主推推荐，补充算法候选至10个
                const aiTop3 = mappedProducts.slice(0, 3).map((p: any) => ({
                    ...p,
                    reason: sanitizeReason(p.reason || algorithmRecs.find((r: any) => r.id === p.id)?.reason || "为您精选的护肤产品")
                }));
                const remaining = algorithmRecs.filter((ar: any) => !aiTop3.some((p: any) => p.id === ar.id));
                finalProducts = [...aiTop3, ...remaining].slice(0, 10);
            }
        }

        // 如果 AI 没返回有效产品 (或映射全失败)，使用推荐算法兜底
        if (finalProducts.length === 0) {
            console.log("AI products invalid/empty, using recommendation engine fallback");
            finalProducts = algorithmRecs;
        }

        // 统一清理所有推荐理由中的英文词汇（兜底）
        finalProducts = finalProducts.map((p: any) => ({
            ...p,
            reason: sanitizeReason(p.reason)
        }));

        // 8. Construct Final Standardized Result (Matching ComprehensiveResult Interface)

        // Enhance Face Analysis with Text AI Recommendations if missing
        let finalFaceAnalysis = faceAnalysis || resultJson.faceAnalysis || null;
        if (finalFaceAnalysis) {
            // Ensure recommendations exist
            if (!finalFaceAnalysis.recommendations) {
                finalFaceAnalysis.recommendations = [];
            }

            // Preserve gender if available in original input
            if (faceAnalysis?.gender && !finalFaceAnalysis.gender) {
                finalFaceAnalysis.gender = faceAnalysis.gender;
            }

            // If recommendations are empty or we have better ones from text analysis
            if (resultJson.lifestyleTips && Array.isArray(resultJson.lifestyleTips)) {
                // Clean up duplicates if any
                const newRecs = resultJson.lifestyleTips.filter((tip: string) =>
                    !finalFaceAnalysis.recommendations.includes(tip)
                );
                finalFaceAnalysis.recommendations = [...finalFaceAnalysis.recommendations, ...newRecs];
            }


        }

        const standardizedResult = {
            skinProfile: {
                type: finalSkinType,
                typeLabel: skinTypeLabel,
                concerns: concerns,
                skinAge: faceAnalysis?.skinAge?.estimated || 25
            },
            analysis: {
                summary: resultJson.summary || "根据您的问卷及面部数据，我们为您生成了这份综合分析报告。",
                details: [
                    resultJson.skinTypeAnalysis || "",
                    ...(resultJson.concernAnalysis || [])
                ].filter(Boolean)
            },
            products: finalProducts,
            faceAnalysis: finalFaceAnalysis, // Ensure faceAnalysis is propagated
            dataSource: "hybrid",
            userLocation: geoLocation,
            nickname: nickname || "护肤达人" // Include user nickname for sharing
        };

        // 9. Persist Result to DB (all users including guests)
        if (sessionId) {
            // 游客报告保留3小时，注册用户报告保留3个月
            const expiresAt = user?.id
                ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                : new Date(Date.now() + 3 * 60 * 60 * 1000);

            await prisma.$transaction(async (tx) => {
                // Fetch existing session first to avoid overwriting parallel avatar data
                // (Avatar generation might have finished first and saved to DB)
                const existingSession = await tx.advisorSession.findUnique({
                    where: { sessionId },
                    select: { analysisResult: true }
                });

                // Also check avatarQueue in case avatar was generated before session was created
                const avatarQueueItem = await tx.avatarQueue.findUnique({
                    where: { sessionId },
                    select: { generatedUrl: true }
                });

                // Merge current results with any existing data (like generatedAvatar)
                const mergedResult = {
                    ...(existingSession?.analysisResult as any || {}),
                    ...standardizedResult,
                    ...(avatarQueueItem?.generatedUrl ? { generatedAvatar: avatarQueueItem.generatedUrl } : {}),
                    ...(isFreeRetryAllowed ? { freeRetryUsed: true } : {})
                };

                await tx.advisorSession.upsert({
                    where: { sessionId },
                    update: {
                        analysisResult: mergedResult as any, // stored as json
                        analysisSource: "hybrid",
                        completedAt: new Date(),
                        province: geoLocation?.region,
                        city: geoLocation?.city,
                        expiresAt: expiresAt
                    },
                    create: {
                        sessionId,
                        analysisResult: mergedResult as any,
                        analysisSource: "hybrid",
                        completedAt: new Date(),
                        province: geoLocation?.region,
                        city: geoLocation?.city,
                        expiresAt: expiresAt
                    }
                });

                // 报告生成后，立即清空原始问卷数据（即用即删）
                await tx.advisorSession.updateMany({
                    where: { sessionId },
                    data: { answers: Prisma.JsonNull }
                });
            }).catch(err => console.error("Failed to persist final analysis:", err));

            // ====== 微信公众号推送逻辑 ======
            if (user?.id) {
                // 如果用户登录了，去查一次他的真实 OpenID
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { wechatOpenId: true }
                });

                if (dbUser?.wechatOpenId) {
                    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://advisor.nihplod.cn";

                    // 决定分数和核心问题
                    const score = faceAnalysis?.overallScore || 85;
                    let primaryConcern = "肤色暗沉或不均";
                    if (concerns && concerns.length > 0) {
                        primaryConcern = concerns.join("、");
                    }

                    // 异步触发，绝不阻塞前端响应时间
                    sendSkinReportTemplateMessage(
                        dbUser.wechatOpenId,
                        {
                            score: score,
                            primaryConcern: primaryConcern,
                        },
                        `${baseUrl}/report/${sessionId}` // 这个分享页是现成的
                    ).catch(err => console.error("微信推送执行异常:", err));
                }
            }
        }

        // 10. 记录使用次数（AI 成功生成结果后才扣额度，免费重试不扣）
        // 幂等性保护：recordUsage 内部会检查 sessionId 是否已记录
        if (sessionId && !isFreeRetryAllowed) {
            await recordUsage(request, sessionId, body);
        }

        return NextResponse.json(standardizedResult, { headers: rateLimitHeaders });

    } catch (error: any) {
        if (error.message?.includes("cancelled") || error.name === 'AbortError') {
            return NextResponse.json(
                { error: "分析请求已取消，请重试" },
                { status: 499 }
            );
        }
        console.error("Advisor analysis failed:", error);
        return NextResponse.json(
            { error: "生成分析报告失败，请重试" },
            { status: 500 }
        );
    } finally {
        clearTimeout(serverTimeout);
        request.signal.removeEventListener('abort', onClientAbort);
    }
}
