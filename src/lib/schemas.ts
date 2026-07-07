
import { z } from "zod";

// ============================================================================
// 通用验证规则
// ============================================================================

export const SessionIdSchema = z.string().min(1, "Session ID 不能为空");

// ============================================================================
// 分析 API 验证规则
// ============================================================================

export const AnalyzeRequestSchema = z.object({
    sessionId: SessionIdSchema.optional(), // 可选，如果客户端已生成
    nickname: z.string().max(10).optional(), // 用户昵称
    freeRetry: z.boolean().optional(), // 性别不匹配免费重试标记
    privacyConsent: z.object({
        version: z.string(),
        consentedAt: z.string()
    }).nullable().optional(),

    // 问卷答案
    answers: z.object({
        skinType: z.string().optional(),
        primaryConcern: z.union([z.string(), z.array(z.string())]).optional(),
        ageRange: z.string().optional(),
        gender: z.string().optional(),

        allergies: z.union([z.string(), z.array(z.string())]).optional(),
        budget: z.string().optional(),
        skincareFrequency: z.string().optional(),
        pregnancyStatus: z.string().optional(),
        medicationHistory: z.string().optional(),
        sleepQuality: z.string().optional(),
        stressLevel: z.string().optional(),
        waterIntake: z.string().optional(),
        exerciseFrequency: z.string().optional(),
        dietaryHabits: z.string().optional(),
        sunExposure: z.string().optional(),
        location: z.string().optional(),
    }).refine(data => Object.keys(data).length > 0, {
        message: "问卷数据不能为空"
    }),

    // 面部分析结果（可选）
    faceAnalysis: z.object({
        skinType: z.object({
            type: z.string(),
            confidence: z.number().optional(),
            description: z.string().optional()
        }).optional(),
        gender: z.object({
            value: z.enum(["male", "female"]),
            confidence: z.number()
        }).optional(),
        dimensions: z.record(z.string(), z.object({
            score: z.number().optional(),
            percentile: z.number().optional(),
            grade: z.enum(["excellent", "good", "average", "fair", "poor"]).optional(),
            details: z.string().optional(),
        })).optional(),
        overallScore: z.number().optional(),
        skinAge: z.object({
            estimated: z.number().optional(),
            factors: z.array(z.string()).optional()
        }).optional(),
        hydration: z.object({
            level: z.string().optional(),
            percent: z.number().optional()
        }).optional(),
        skinConditions: z.array(z.object({
            condition: z.string(),
            severity: z.string().optional(),
            area: z.string().optional(),
            description: z.string().optional()
        })).optional(),
        summary: z.string().optional(),
        recommendations: z.array(z.string()).optional(),
        zoneAnalysis: z.record(z.string(), z.object({
            condition: z.string().optional(),
            advice: z.string().optional(),
            oil: z.number().optional(),
            texture: z.number().optional(),
            wrinkles: z.number().optional(),
            spots: z.number().optional(),
            redness: z.number().optional(),
            darkCircles: z.number().optional(),
            firmness: z.number().optional(),
            contour: z.number().optional(),
        })).optional(),
        labAnalysis: z.object({
            glogau: z.object({ value: z.string(), status: z.string() }).optional(),
            homogeneity: z.object({ value: z.number(), unit: z.string(), status: z.string() }).optional(),
            wrinkleGrade: z.object({ value: z.string(), status: z.string() }).optional(),
        }).optional(),
    }).nullable().optional()
});

// ============================================================================
// 分享图片 API 验证规则
// ============================================================================

export const ShareImageRequestSchema = z.object({
    score: z.number().optional(),
    skinType: z.string().optional(),
    date: z.string().optional(),
    summary: z.string().optional(),
    radarData: z.record(z.string(), z.unknown()).optional(), // 维度数据
    dimensions: z.record(z.string(), z.object({
        score: z.number().optional(),
        percentile: z.number().optional(),
        grade: z.enum(["excellent", "good", "average", "fair", "poor"]).optional(),
        details: z.string().optional(),
    })).optional(),
    userInfo: z.object({
        name: z.string().optional(),
        avatar: z.string().optional()
    }).optional()
});

// ============================================================================
// 面部分析 API 验证规则
// ============================================================================

// 面部分析输入约束：控制单张大小与总张数，降低 vision 模型 token 费用与 413 风险
const MAX_IMAGE_BASE64_CHARS = 1_500_000; // 约 1.1MB 原始数据
const MAX_VISION_IMAGES = 4;

export const FaceAnalyzeRequestSchema = z.object({
    sessionId: z.string().uuid().optional(), // 业务会话 ID，用于复用额度
    images: z.union([
        // 支持新的数组格式 [{ data: "base64", angle: "front" }]
        z.array(
            z.object({
                data: z.string().max(MAX_IMAGE_BASE64_CHARS, "单张图片过大，请压缩后重试"),
                angle: z.string()
            })
        ).max(MAX_VISION_IMAGES, `最多上传 ${MAX_VISION_IMAGES} 张照片`),
        // 兼容旧的对象格式 { front: "base64" }
        z.object({
            front: z.string().optional(),
            left: z.string().optional(),
            right: z.string().optional(),
            chin: z.string().optional(),
        })
    ]).optional(),
    image: z.string().max(MAX_IMAGE_BASE64_CHARS, "单张图片过大，请压缩后重试").optional(), // 兼容旧版单图
}).refine(data => {
    if (data.image) return true;
    if (Array.isArray(data.images)) return data.images.length > 0;
    if (data.images && typeof data.images === 'object') return !!(data.images as { front?: string }).front;
    return false;
}, {
    message: "请至少提供一张正面照片"
});

export type AnalyzerRequest = z.infer<typeof AnalyzeRequestSchema>;
