
import { z } from "zod";

// ============================================================================
// 通用验证规则
// ============================================================================

// 前端使用 UUID 或 8-128 位字母数字/连字符 ID；统一约束，避免 analyze 能写入
// 而 view/feedback/status 路由无法读取的“孤儿 sessionId”。
export const SessionIdSchema = z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z-]{8,128}$/, "Session ID 格式不正确");

// ============================================================================
// 分析 API 验证规则
// ============================================================================

// 数值范围钳制：拒绝会破坏合法流程（AI 偶发输出 100.4 等），
// 超界值钳回合法区间，防止伪造请求注入极端分数污染日记/推送/趋势基准
const clampNumber = (min: number, max: number) =>
    z.number().transform((n) => Math.min(max, Math.max(min, n)));
// 分数/百分比类：0-100
const scoreSchema = clampNumber(0, 100);
// 置信度：历史存在 0-1 与 0-100 两种口径，统一钳到 0-100，下游 determineSkinType 负责归一化
const confidenceSchema = clampNumber(0, 100);
// 肌龄合理区间
const skinAgeSchema = clampNumber(10, 90);

const zoneDataSchema = z.object({
    condition: z.string().optional(),
    advice: z.string().optional(),
    oil: scoreSchema.optional(),
    texture: scoreSchema.optional(),
    wrinkles: scoreSchema.optional(),
    spots: scoreSchema.optional(),
    redness: scoreSchema.optional(),
    darkCircles: scoreSchema.optional(),
    firmness: scoreSchema.optional(),
    contour: scoreSchema.optional(),
}).passthrough();

export const AnalyzeRequestSchema = z.object({
    sessionId: SessionIdSchema.optional(), // 可选，如果客户端已生成
    nickname: z.string().max(20).optional(), // 用户昵称（与主站 profile 的 20 字符上限一致）
    freeRetry: z.boolean().optional(), // 性别不匹配免费重试标记
    clientDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // 客户端本地日历日，用于自动生成护肤日记
    skinState: z.string().max(30).optional(), // 拍摄时肌肤状态（扫脸引导弹窗选择）
    privacyConsent: z.object({
        version: z.string(),
        consentedAt: z.string()
    }).nullable().optional(),

    // 问卷答案（限制单字段/数组长度，防止超大 body 与 prompt 膨胀）
    answers: z.object({
        skinType: z.string().max(100).optional(),
        primaryConcern: z.union([z.string().max(500), z.array(z.string().max(100)).max(20)]).optional(),
        ageRange: z.string().max(50).optional(),
        gender: z.string().max(20).optional(),

        allergies: z.union([z.string().max(500), z.array(z.string().max(100)).max(20)]).optional(),
        budget: z.string().max(50).optional(),
        skincareFrequency: z.string().max(50).optional(),
        skincareLevel: z.string().max(50).optional(),
        pregnancy: z.string().max(20).optional(),
        pregnancyStatus: z.string().max(20).optional(),
        medicalBeauty: z.string().max(50).optional(),
        menstrualCycle: z.string().max(50).optional(),
        medicationHistory: z.string().max(500).optional(),
        sleepQuality: z.string().max(50).optional(),
        stressLevel: z.string().max(50).optional(),
        waterIntake: z.string().max(50).optional(),
        exerciseFrequency: z.string().max(50).optional(),
        dietaryHabits: z.string().max(50).optional(),
        sunExposure: z.string().max(50).optional(),
        location: z.string().max(100).optional(),
    }).refine(data => Object.keys(data).length > 0, {
        message: "问卷数据不能为空"
    }),

    // 面部分析结果（可选）
    faceAnalysis: z.object({
        skinType: z.object({
            type: z.string(),
            confidence: confidenceSchema.optional(),
            description: z.string().optional()
        }).optional(),
        gender: z.object({
            value: z.enum(["male", "female"]),
            confidence: confidenceSchema
        }).optional(),
        dimensions: z.record(z.string(), z.object({
            score: scoreSchema.optional(),
            percentile: scoreSchema.optional(),
            grade: z.enum(["excellent", "good", "average", "fair", "poor"]).optional(),
            details: z.string().optional(),
            // acne 子分（黑头/炎性痘）：v2 报告证据链与十维口径依赖，缺少会被 zod 默认剥离
            blackheads: scoreSchema.optional(),
            pimples: scoreSchema.optional(),
        })).optional(),
        overallScore: scoreSchema.optional(),
        skinAge: z.object({
            estimated: skinAgeSchema.optional(),
            factors: z.array(z.string()).optional()
        }).optional(),
        hydration: z.object({
            level: z.string().optional(),
            percent: scoreSchema.optional()
        }).optional(),
        skinConditions: z.array(z.object({
            condition: z.string(),
            severity: z.string().optional(),
            area: z.string().optional(),
            description: z.string().optional()
        })).optional(),
        summary: z.string().optional(),
        recommendations: z.array(z.string()).optional(),
        zoneAnalysis: z.object({
            forehead: zoneDataSchema,
            tZone: zoneDataSchema,
            leftCheek: zoneDataSchema,
            rightCheek: zoneDataSchema,
            eyeArea: zoneDataSchema,
            jawline: zoneDataSchema,
        }).optional(),
        labAnalysis: z.object({
            glogau: z.object({ value: z.string(), status: z.string() }).optional(),
            homogeneity: z.object({ value: z.number().optional(), unit: z.string().optional(), range: z.string().optional(), status: z.string() }).optional(),
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
    sessionId: SessionIdSchema.optional(), // 业务会话 ID，用于复用额度
    images: z.union([
        // 支持新的数组格式 [{ data: "base64", angle: "front" }]
        z.array(
            z.object({
                data: z.string().max(MAX_IMAGE_BASE64_CHARS, "单张图片过大，请压缩后重试"),
                angle: z.string().max(20)
            })
        ).max(MAX_VISION_IMAGES, `最多上传 ${MAX_VISION_IMAGES} 张照片`),
        // 兼容旧的对象格式 { front: "base64" }
        z.object({
            front: z.string().max(MAX_IMAGE_BASE64_CHARS, "单张图片过大，请压缩后重试").optional(),
            left: z.string().max(MAX_IMAGE_BASE64_CHARS, "单张图片过大，请压缩后重试").optional(),
            right: z.string().max(MAX_IMAGE_BASE64_CHARS, "单张图片过大，请压缩后重试").optional(),
            chin: z.string().max(MAX_IMAGE_BASE64_CHARS, "单张图片过大，请压缩后重试").optional(),
        })
    ]).optional(),
    image: z.string().max(MAX_IMAGE_BASE64_CHARS, "单张图片过大，请压缩后重试").optional(), // 兼容旧版单图
    // 分析图片用途：front_only = 四角度拍摄但只允许正脸进入 AI；缺省按旧客户端兼容
    imageUsage: z.enum(["front_only", "multi"]).optional(),
    skinState: z.string().max(30).optional(), // 拍摄时肌肤状态（bare/sunscreen/washed/light_makeup/heavy_makeup）
    // 性别不一致免费重试：复用已完成会话的服务端面部结果，不重复调用视觉模型
    freeRetry: z.boolean().optional(),
}).refine(data => {
    if (data.image) return true;
    if (Array.isArray(data.images)) return data.images.length > 0;
    if (data.images && typeof data.images === 'object') return !!(data.images as { front?: string }).front;
    return false;
}, {
    message: "请至少提供一张正面照片"
});

export type AnalyzerRequest = z.infer<typeof AnalyzeRequestSchema>;
