import { NextRequest, NextResponse } from "next/server";
import { generateText, isAIEnabled, fallbackAnalysis } from "@/lib/ai";
import { extractJsonFromResponse } from "@/lib/advisor-utils";
import { buildTextAnalysisPrompt } from "@/config/ai-prompts";
import { rateLimit } from "@/lib/ratelimit";
import prisma from "@/lib/prisma";
import { getSkinTypeLabel } from "@/lib/advisor-utils";
// import { PRODUCTS_CATALOG } from "@/config/products"; // Deprecated, use DB or matchProducts
import { determineSkinType, identifyConcerns } from "@/lib/advisor-utils";
import { AnalyzeRequestSchema } from "@/lib/schemas";
import { recommendProducts, getCandidateProducts } from "@/lib/recommendations";
import { resolveIPLocation } from "@/lib/geoip";
import { getSession } from "@/lib/auth";
import { hashIP } from "@/lib/privacy";

import { checkUsageLimit, recordUsage } from "@/lib/usage-limit";
import { sendSkinReportTemplateMessage } from "@/lib/wechat";

export async function POST(request: NextRequest) {
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
        const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
        const limit = await rateLimit(`advisor-analyze-${ip}`, "comprehensive-analyze", { maxRequests: 20 });

        const geoLocation = resolveIPLocation(ip);
        const rateLimitHeaders = {
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
        // freeRetry = 性别不匹配后的免费重试，跳过额度检查
        if (!freeRetry) {
            const usageLimit = await checkUsageLimit(request, body);
            if (!usageLimit.canTest) {
                return NextResponse.json(
                    { error: usageLimit.error || "您已达到今日测试上限" },
                    { status: 429 }
                );
            }
        }

        // 5. 记录使用次数（验证通过后才扣额度，免费重试不扣）
        if (sessionId && !freeRetry) {
            await recordUsage(request, sessionId, body);
        }

        // 注入地理位置 (如果用户未提供)
        if (!answers.location && geoLocation) {
            answers.location = `${geoLocation.region || ''} ${geoLocation.city || ''}`.trim();
        }

        // 6. 检查用户登录状态
        const user = await getSession();

        // 保存会话记录到数据库（所有用户，包括访客）
        if (sessionId) {
            await prisma.advisorSession.upsert({
                where: { sessionId },
                update: {
                    answers,
                    analysisSource: faceAnalysis ? "hybrid" : "text",
                    faceScanUsed: !!faceAnalysis,
                    completedAt: new Date(),
                    // Save Geo Info
                    province: geoLocation?.region,
                    city: geoLocation?.city,
                    ip: hashIP(ip),
                    userId: user?.id || null
                },
                create: {
                    sessionId,
                    answers,
                    analysisSource: faceAnalysis ? "hybrid" : "text",
                    faceScanUsed: !!faceAnalysis,
                    completedAt: new Date(),
                    province: geoLocation?.region,
                    city: geoLocation?.city,
                    ip: hashIP(ip),
                    userId: user?.id || null
                }
            }).catch((err: unknown) => console.error("Session save error:", err));
        }

        // 4. 检查 AI 开关
        const aiEnabled = await isAIEnabled();

        if (!aiEnabled) {
            console.log("AI Disabled, using fallback analysis");
            // 降级模式：使用规则引擎生成面部分析数据
            const fallbackFace = fallbackAnalysis(answers as any);

            // 补全产品推荐 (DB)
            const concerns = identifyConcerns(answers as any);
            const products = await recommendProducts(answers as any, concerns);

            // 构造符合 ComprehensiveResult 结构的数据
            const finalResult = {
                skinAnalysis: {
                    skinType: fallbackFace.skinType.type,
                    skinTypeLabel: getSkinTypeLabel(fallbackFace.skinType.type),
                    concerns: concerns,
                    summary: fallbackFace.skinType.description || "基于您的问卷数据生成的初步分析报告。",
                    details: [
                        "由于 AI 服务暂时不可用，本报告基于您的问卷回答生成。",
                        `检测到的主要肤质特征为：${getSkinTypeLabel(fallbackFace.skinType.type)}。`,
                        ...fallbackFace.recommendations
                    ],
                    skinAge: 25
                },
                faceAnalysis: fallbackFace,
                products: products,
                userLocation: geoLocation
            };

            return NextResponse.json(finalResult, { headers: rateLimitHeaders });
        }

        // 5. 构建 AI 提示词与调用
        // FETCH PRODUCTS (Candidate Selection / RAG Lite)
        const concerns = identifyConcerns(answers as any); // Pre-calculate concerns
        const candidateProducts = await getCandidateProducts(answers as any, concerns, 20); // Top 20

        // Resolve Skin Type (Priority: Face Analysis > User Answer)
        const finalSkinType = determineSkinType(answers, (faceAnalysis as any) || undefined);
        const skinTypeLabel = getSkinTypeLabel(finalSkinType);

        const userPrompt = buildTextAnalysisPrompt({
            skinTypeLabel,
            ageRange: answers.ageRange,
            concerns: answers.concerns,
            medicalBeauty: (answers as any).medicalBeauty,
            sleep: (answers as any).sleepQuality,
            faceAnalysis: faceAnalysis ? {
                skinType: faceAnalysis.skinType as any,
                dimensions: faceAnalysis.dimensions,
                overallScore: faceAnalysis.overallScore
            } : undefined,
            products: candidateProducts
        });

        const systemPrompt = "你是一位专业的皮肤专家，请根据用户数据生成 JSON 格式的护肤报告。";

        // 调用 AI
        const provider = process.env.AI_PROVIDER || "openai";
        console.log(`Starting text analysis with ${provider}...`);

        let resultJson: any;
        try {
            const resultText = await generateText(systemPrompt, userPrompt, provider as any);
            resultJson = extractJsonFromResponse<any>(resultText);
        } catch (e) {
            console.error("AI Generation failed, falling back", e);
            // Fallback if AI text gen fails but we have DB
            resultJson = {};
        }

        if (!resultJson) {
            resultJson = {}; // Safety
        }

        // 6. 补全产品详情
        let finalProducts: any[] = [];
        // reusable concerns already defined above

        if (resultJson.products && Array.isArray(resultJson.products)) {
            const mappedProducts = resultJson.products.map((p: any) => {
                // strict match against candidate pool to enforce RAG boundaries
                const catalogProduct = candidateProducts.find((cp: any) => cp.id === p.id);
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
                        benefits: catalogProduct.benefits || []
                    };
                }
                return null;
            }).filter(Boolean);

            if (mappedProducts.length > 0) {
                finalProducts = mappedProducts;
            }
        }

        // 如果 AI 没返回有效产品 (或映射全失败)，使用推荐算法兜底
        if (finalProducts.length === 0) {
            console.log("AI products invalid/empty, using recommendation engine fallback");
            // Pass candidateProducts to avoid duplicate DB query
            const recs = await recommendProducts(answers as any, concerns, candidateProducts);
            finalProducts = recs;
        }

        // 7. Construct Final Standardized Result (Matching ComprehensiveResult Interface)

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

            // Also include Routine steps if recommendations are still sparse
            if (finalFaceAnalysis.recommendations.length < 3 && resultJson.routine) {
                if (resultJson.routine.morning) {
                    finalFaceAnalysis.recommendations.push(`早间护肤：${resultJson.routine.morning.join(' > ')}`);
                }
                if (resultJson.routine.evening) {
                    finalFaceAnalysis.recommendations.push(`晚间护肤：${resultJson.routine.evening.join(' > ')}`);
                }
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

        // 8. Persist Result to DB (all users including guests)
        if (sessionId) {
            // Calculate Expiration Date (30 days from now)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            await prisma.advisorSession.update({
                where: { sessionId },
                data: {
                    analysisResult: standardizedResult as any, // stored as json
                    analysisSource: faceAnalysis ? "hybrid" : "text",
                    completedAt: new Date(),
                    province: geoLocation?.region,
                    city: geoLocation?.city,
                    expiresAt: expiresAt
                }
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

        return NextResponse.json(standardizedResult, { headers: rateLimitHeaders });

    } catch (error) {
        console.error("Advisor analysis failed:", error);
        return NextResponse.json(
            { error: "生成分析报告失败，请重试" },
            { status: 500 }
        );
    }
}
