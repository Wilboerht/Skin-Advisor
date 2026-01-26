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

        // Dynamic imports for file handling
        const fs = await import('fs/promises');
        const path = await import('path');
        const process = await import('process');
        // Lazy import sharp to avoid startup overhead if not used
        let sharp: any;
        try {
            sharp = (await import('sharp')).default;
        } catch (e) {
            aiLogger.warn("Sharp module not found, compression disabled");
        }

        // Helper to resolve and optionally compress image data
        const resolveImageData = async (imgData: string, compress: boolean = false) => {
            if (!imgData) return null;

            // If it's a full URL (http/https/oss), return as is
            if (imgData.startsWith('http')) return imgData;

            // Handle Local Files (or relative paths)
            let buffer: Buffer | null = null;
            let mimeType = 'image/jpeg';
            let isLocalFile = false;

            // Check if it is a local path
            if ((imgData.startsWith('/') || imgData.startsWith('\\')) && !imgData.startsWith('data:')) {
                try {
                    // Remove leading slash
                    let relativePath = imgData.startsWith('/') ? imgData.slice(1) : imgData;

                    // IF relativePath already starts with "uploads/", DO NOT add it again.
                    // The error log showed: .../public/uploads/uploads/... which is wrong.

                    let filePath: string;
                    if (relativePath.startsWith('uploads/') || relativePath.startsWith('uploads\\')) {
                        filePath = path.join(process.cwd(), 'public', relativePath);
                    } else {
                        filePath = path.join(process.cwd(), 'public', 'uploads', relativePath);
                    }

                    buffer = await fs.readFile(filePath);
                    const ext = path.extname(filePath).toLowerCase();
                    mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
                    isLocalFile = true;
                } catch (e: any) {
                    aiLogger.warn(`Failed to resolve local image path: ${imgData}`, { error: e.message });
                    return null;
                }
            }
            // Handle Base64 (if we wanted to compress incoming base64 we would decode it here, 
            // but currently we focus on the file -> large base64 issue)
            else if (imgData.startsWith('data:')) {
                // If needed, we could parse buffer here for compression, but for now return as is unless requested
                return imgData;
            } else {
                return imgData; // return as is (unknown format)
            }

            // Apply Compression if requested and we have a buffer
            if (compress && buffer && sharp) {
                try {
                    aiLogger.info(`Compressing image...`);
                    buffer = await sharp(buffer)
                        .resize({ width: 1024, fit: 'inside', withoutEnlargement: true }) // Limit max dimension to 1024
                        .jpeg({ quality: 75 }) // Moderate compression
                        .toBuffer();
                    mimeType = 'image/jpeg'; // details: always convert to jpeg for consistency/size
                } catch (e: any) {
                    aiLogger.error("Image compression failed", e);
                    // Fallback to original buffer
                }
            }

            if (buffer) {
                return `data:${mimeType};base64,${buffer.toString('base64')}`;
            }

            return imgData;
        };

        // Helper to prepare valid images list
        const loadImages = async (compress: boolean) => {
            const validImages: VisionImage[] = [];
            if (images) {
                if (images.front) {
                    const data = await resolveImageData(images.front, compress);
                    if (data) validImages.push({ angle: "正脸", data });
                }
                if (images.left) {
                    const data = await resolveImageData(images.left, compress);
                    if (data) validImages.push({ angle: "左侧脸", data });
                }
                if (images.right) {
                    const data = await resolveImageData(images.right, compress);
                    if (data) validImages.push({ angle: "右侧脸", data });
                }
                if (images.chin) {
                    const data = await resolveImageData(images.chin, compress);
                    if (data) validImages.push({ angle: "下巴/颈部", data });
                }
            }
            return validImages;
        };

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

            // Unified Call with Retry Mechanism
            let validImages = await loadImages(false); // Try with original quality first

            try {
                unifiedResult = await callUnifiedAI(
                    validImages,
                    userAnswersContext,
                    productsContext
                );
            } catch (e: any) {
                // If error is 400 (Bad Request) or related to base64/payload size, retry with compression
                const isPayloadError = e.message?.includes('400') || e.message?.includes('base64') || e.message?.includes('too large');

                if (isPayloadError) {
                    aiLogger.warn(`[${requestId}] AI Analysis failing with payload error (${e.message}). Retrying with COMPRESSED images...`);

                    // Reload images with compression enabled
                    validImages = await loadImages(true);

                    try {
                        unifiedResult = await callUnifiedAI(
                            validImages,
                            userAnswersContext,
                            productsContext
                        );
                        aiLogger.info(`[${requestId}] Retry with compression SUCCESSFUL.`);
                    } catch (retryError: any) {
                        aiLogger.error(`[${requestId}] Retry with compression FAILED`, retryError);
                        throw retryError; // Throw original or new error
                    }
                } else {
                    throw e; // Throw if it's not a payload error (e.g. 500, timeout)
                }
            }

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
