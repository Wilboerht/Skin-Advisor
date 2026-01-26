
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

    // 问卷答案
    answers: z.object({
        skinType: z.string().optional(),
        primaryConcern: z.union([z.string(), z.array(z.string())]).optional(),
        concerns: z.array(z.string()).optional(),
        ageRange: z.string().optional(),
        gender: z.string().optional(),
        currentRoutine: z.string().optional(),
        allergies: z.string().optional(),
        budget: z.string().optional(),
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
        dimensions: z.record(z.string(), z.any()).optional(),
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
        })).optional()
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
    radarData: z.record(z.any()).optional(), // 维度数据
    dimensions: z.record(z.any()).optional(),
    userInfo: z.object({
        name: z.string().optional(),
        avatar: z.string().optional()
    }).optional()
});

// ============================================================================
// 面部分析 API 验证规则
// ============================================================================

// ============================================================================
// 面部分析 API 验证规则
// ============================================================================

export const FaceAnalyzeRequestSchema = z.object({
    images: z.union([
        // 支持新的数组格式 [{ data: "base64", angle: "front" }]
        z.array(z.object({
            data: z.string(),
            angle: z.string()
        })),
        // 兼容旧的对象格式 { front: "base64" }
        z.object({
            front: z.string().optional(),
            left: z.string().optional(),
            right: z.string().optional(),
            chin: z.string().optional(),
        })
    ]).optional(),
    image: z.string().optional(), // 兼容旧版单图
}).refine(data => {
    if (data.image) return true;
    if (Array.isArray(data.images)) return data.images.length > 0;
    if (data.images && typeof data.images === 'object') return !!(data.images as any).front;
    return false;
}, {
    message: "请至少提供一张正面照片"
});

// ============================================================================
// 聊天 API 验证规则
// ============================================================================

export const ChatRequestSchema = z.object({
    sessionId: SessionIdSchema,
    message: z.string().min(1, "消息不能为空").max(500, "消息过长（限制500字符）"),
    context: z.object({
        skinType: z.string().optional(),
        concerns: z.array(z.string()).optional(),
        summary: z.string().optional()
    }).optional()
});

export type AnalyzerRequest = z.infer<typeof AnalyzeRequestSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
