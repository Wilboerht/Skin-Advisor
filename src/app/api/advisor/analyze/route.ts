import { NextRequest, NextResponse } from "next/server";
import { generateText, isAIEnabled, fallbackAnalysis } from "@/lib/ai";
import { extractJsonFromResponse, matchProducts } from "@/lib/advisor-utils";
import { buildTextAnalysisPrompt } from "@/config/ai-prompts";
import { rateLimit } from "@/lib/ratelimit";
import prisma from "@/lib/prisma";
import { getSkinTypeLabel } from "@/lib/advisor-utils";
// import { PRODUCTS_CATALOG } from "@/config/products"; // Deprecated, use DB or matchProducts
import { determineSkinType, identifyConcerns } from "@/lib/advisor-utils";
import { AnalyzeRequestSchema } from "@/lib/schemas";
import { recommendProducts } from "@/lib/recommendations";
import { resolveIPLocation } from "@/lib/geoip";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        // 1. 速率限制 & 地理位置
        const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
        const limit = await rateLimit(`advisor-analyze-${ip}`, "comprehensive-analyze", { maxRequests: 10 });

        // 尝试获取位置
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

        // 2. 解析与验证
        const body = await request.json();

        // 使用 Zod 验证
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

        const { answers, faceAnalysis, sessionId } = result.data;

        // 注入地理位置 (如果用户未提供)
        if (!answers.location && geoLocation) {
            answers.location = `${geoLocation.region || ''} ${geoLocation.city || ''}`.trim();
        }

        // 3. 保存会话记录 (异步，不阻塞)
        const user = await getSession();

        if (sessionId) {
            prisma.advisorSession.upsert({
                where: { sessionId },
                update: {
                    answers,
                    analysisSource: faceAnalysis ? "hybrid" : "text",
                    faceScanUsed: !!faceAnalysis,
                    completedAt: new Date(),
                    // Save Geo Info
                    province: geoLocation?.region,
                    city: geoLocation?.city,
                    ip: ip, // Note: Should hash IP in production for privacy
                    userId: user?.id
                },
                create: {
                    sessionId,
                    answers,
                    analysisSource: faceAnalysis ? "hybrid" : "text",
                    faceScanUsed: !!faceAnalysis,
                    completedAt: new Date(),
                    province: geoLocation?.region,
                    city: geoLocation?.city,
                    ip: ip,
                    userId: user?.id
                }
            }).catch((err: unknown) => console.error("Session save error:", err));
        }

        // 4. 检查 AI 开关
        const aiEnabled = await isAIEnabled();

        if (!aiEnabled) {
            console.log("AI Disabled, using fallback analysis");
            // 降级模式：使用规则引擎
            const fallbackResult: any = fallbackAnalysis(answers as any);

            // 补全产品推荐 (DB)
            const concerns = identifyConcerns(answers as any);
            const products = await recommendProducts(answers as any, concerns);
            fallbackResult.recommendations = products.map(p => p.name); // 更新建议文案
            fallbackResult.products = products; // 附加产品列表

            return NextResponse.json({
                ...fallbackResult,
                userLocation: geoLocation // Return generic location info
            }, { headers: rateLimitHeaders });
        }

        // 5. 构建 AI 提示词与调用
        // FETCH PRODUCTS FROM DB
        const availableProducts = await prisma.product.findMany({
            where: { active: true }
        });

        const skinTypeLabel = getSkinTypeLabel(answers.skinType || "unknown");
        const userPrompt = buildTextAnalysisPrompt({
            skinTypeLabel,
            ageRange: answers.ageRange,
            concerns: answers.concerns,
            medicalBeauty: (answers as any).medicalBeauty,
            sleep: (answers as any).sleep,
            faceAnalysis: faceAnalysis ? {
                skinType: faceAnalysis.skinType as any,
                dimensions: faceAnalysis.dimensions,
                overallScore: faceAnalysis.overallScore
            } : undefined,
            products: availableProducts,
            // Include location in prompt explicitly if needed, currently part of 'answers' potentially not fully used by prompt builder?
            // Checking buildTextAnalysisPrompt signature... it doesn't take location explicitly but might be in answers if casted?
            // Let's assume prompt builder uses what it needs.
        });

        const systemPrompt = "你是一位专业的皮肤专家，请根据用户数据生成 JSON 格式的护肤报告。";

        // 调用 AI
        const provider = process.env.AI_PROVIDER || "openai";
        console.log(`Starting text analysis with ${provider}...`);

        const resultText = await generateText(systemPrompt, userPrompt, provider as any);
        const resultJson = extractJsonFromResponse<any>(resultText);

        if (!resultJson) {
            throw new Error("Failed to parse AI response");
        }

        // 6. 补全产品详情
        let finalProducts: any[] = [];
        const concerns = identifyConcerns(answers as any);

        if (resultJson.products && Array.isArray(resultJson.products)) {
            const mappedProducts = resultJson.products.map((p: any) => {
                const catalogProduct = availableProducts.find((cp: any) => cp.id === p.id);
                if (catalogProduct) {
                    return {
                        ...p,
                        id: catalogProduct.id,
                        name: catalogProduct.name,
                        nameEn: catalogProduct.nameEn,
                        category: catalogProduct.category,
                        image: catalogProduct.image,
                        price: catalogProduct.price,
                        description: catalogProduct.description
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
            const recs = await recommendProducts(answers as any, concerns);
            finalProducts = recs;
        }

        resultJson.products = finalProducts;
        resultJson.userLocation = geoLocation; // Return location for client use (PDF gen etc)

        return NextResponse.json(resultJson, { headers: rateLimitHeaders });

    } catch (error) {
        console.error("Advisor analysis failed:", error);
        return NextResponse.json(
            { error: "生成分析报告失败，请重试" },
            { status: 500 }
        );
    }
}
