import { NextRequest, NextResponse } from "next/server";
import { aiLogger } from "@/lib/logger";
import { analyzeComprehensiveMultimodal, type VisionImage } from "@/lib/ai-vision";
import { PRODUCTS_CATALOG } from "@/config/products"; // Keep for fallback context structure if needed, or remove if unused
import { rateLimit } from "@/lib/ratelimit";
import { chatQueue } from "@/lib/ai-queue";
import prisma from "@/lib/prisma";
import { identifyConcerns, type QuestionnaireAnswers } from "@/lib/advisor-utils";
import { recommendProducts } from "@/lib/recommendations";
import { generateSkincareRoutine } from "@/lib/ai";

// Helper: Get current season name
function getSeasonName(): string {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return "春季";
    if (month >= 6 && month <= 8) return "夏季";
    if (month >= 9 && month <= 11) return "秋季";
    return "冬季";
}

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * 统一分析结果类型
 */
interface UnifiedAnalysisResult {
    faceAnalysis: any;
    consultation: any;
}

export const maxDuration = 60; // 允许最长 60 秒运行

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 构建用户 Prompt
 */
function buildUserPrompt(answers: any, location: any): string {
    return `
用户资料:
- 肤质: ${answers.skinType || "未知"}
- 疑问/困扰: ${answers.concerns?.join(", ") || "无"}
- 年龄段: ${answers.ageRange || "未知"}
- 医美史: ${answers.medicalHistory || "无"}
- 睡眠: ${answers.sleep || "未知"}
- 所在区域: ${location.province || "未知"} ${location.city || ""}
- 当前季节: ${getSeasonName()}

请根据用户的所在区域气候特点（如寒冷干燥、炎热潮湿等）调整护肤建议。
`;
}

/**
 * 调用统一分析 AI
 */
async function callUnifiedAI(
    images: VisionImage[],
    userAnswersContext: string,
    productsContext: string
): Promise<UnifiedAnalysisResult> {
    const result = await analyzeComprehensiveMultimodal(
        images,
        userAnswersContext,
        productsContext
    );
    return result as UnifiedAnalysisResult;
}

export async function POST(request: NextRequest) {
    const requestId = Math.random().toString(36).substring(7);
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

    try {
        const body = await request.json();
        const { answers, images } = body;

        aiLogger.info(`[${requestId}] Starting unified analysis for IP: ${ip}`, {
            hasImages: !!images
        });

        const limit = await rateLimit(`comprehensive-${ip}`, "comprehensive-analyze", { maxRequests: 3 });
        if (!limit.success) return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });

        const validImages: VisionImage[] = [];
        if (images) {
            if (images.front) validImages.push({ angle: "正脸", data: images.front });
            if (images.left) validImages.push({ angle: "左侧脸", data: images.left });
            if (images.right) validImages.push({ angle: "右侧脸", data: images.right });
            if (images.chin) validImages.push({ angle: "下巴/颈部", data: images.chin });
        }

        let unifiedResult = null;
        let acquired = false;
        let dbProducts: any[] = [];

        try {
            await chatQueue.acquire(); // Use chatQueue as it limits general heavy AI load
            acquired = true;

            // Prepare Contexts
            const location = body.location || {};
            const userAnswersContext = buildUserPrompt(answers, location);

            // 1. Fetch active products from DB for Context
            dbProducts = await prisma.product.findMany({
                where: { active: true },
                select: { id: true, name: true, benefits: true, suitableSkinTypes: true, category: true }
            });

            const productsContext = dbProducts.map(p =>
                `- ID: ${p.id}, 名称: ${p.name}, 功效: ${Array.isArray(p.benefits) ? (p.benefits as string[]).join("/") : p.benefits}, 适用: ${Array.isArray(p.suitableSkinTypes) ? (p.suitableSkinTypes as string[]).join("/") : p.suitableSkinTypes}`
            ).join("\n");

            // Unified Call
            unifiedResult = await callUnifiedAI(
                validImages,
                userAnswersContext,
                productsContext
            );

        } catch (e: any) {
            aiLogger.error(`[${requestId}] Unified Analysis failed`, e);
            return NextResponse.json({ error: "分析生成中断", details: e.message }, { status: 503 });
        } finally {
            if (acquired) chatQueue.release();
        }

        // --- Final Assembly ---
        const { faceAnalysis, consultation } = unifiedResult;

        // 2. Refine Concerns & Recommendations using Algorithm
        const refinedConcerns = identifyConcerns(answers, faceAnalysis);
        const algorithmicProducts = await recommendProducts(answers, refinedConcerns);

        // 3. Smart Product Selection (AI + DB Validation)
        let finalProducts = algorithmicProducts; // Default to algorithm

        if (consultation?.products && Array.isArray(consultation.products) && consultation.products.length > 0) {
            // Validate AI recommendations against DB
            const validAiProducts = consultation.products
                .map((aiProd: any) => {
                    const realProduct = dbProducts.find(p => p.id === aiProd.id);
                    if (realProduct) {
                        return {
                            ...realProduct,
                            // Use AI's personalized reason if available, else generic description
                            reason: aiProd.reason || `适合您的${realProduct.suitableSkinTypes?.[0] || '肤质'}`,
                            // Ensure image field exists (mock or from DB)
                            image: `/images/products/${realProduct.category}.png` // Placeholder mapping
                        };
                    }
                    return null;
                })
                .filter((p: any) => p !== null);

            // Only use AI results if we successfully matched specific products
            if (validAiProducts.length >= 2) {
                finalProducts = validAiProducts;
                aiLogger.info("Using AI product recommendations", { count: finalProducts.length });
            } else {
                aiLogger.warn("AI recommendations invalid or insufficient, falling back to algorithm");
            }
        }

        const finalResult = {
            id: requestId,
            dataSource: "unified-multimodal",
            createdAt: new Date().toISOString(),
            skinProfile: {
                type: faceAnalysis?.skinType?.type || (answers.skinType || "unknown"),
                typeLabel: faceAnalysis?.skinType?.type
                    ? (faceAnalysis.skinType.description || faceAnalysis.skinType.type) // fallback
                    : (answers.skinTypeLabel || "未知"),
                concerns: refinedConcerns, // Use refined concerns
                skinAge: faceAnalysis?.skinAge?.estimated || undefined,
            },
            faceAnalysis: faceAnalysis,
            summary: consultation?.summary || "无法生成总结",
            details: consultation?.skinTypeAnalysis
                ? [consultation.skinTypeAnalysis, ...(consultation.concernAnalysis || [])]
                : [],
            // 3. Override products and routine with Algorithm Result
            products: finalProducts,
            routine: generateSkincareRoutine(answers.currentRoutine || "basic"),
            lifestyleTips: consultation?.lifestyleTips || []
        };

        return NextResponse.json({ success: true, data: finalResult });

    } catch (error) {
        aiLogger.error(`[${requestId}] Critical Error`, { error: error });
        return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
}
