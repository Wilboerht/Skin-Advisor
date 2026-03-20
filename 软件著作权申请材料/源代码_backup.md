# 源代码 - 旎柏AI护肤顾问系统 - 软件著作权申请

---

## 第1-5页：核心AI分析引擎

**文件**：`src/lib/ai-vision.ts`  
**功能**：MySkin.Technology风格10维度面部分析主函数

```typescript
import {
    getAISettings,
    getApiKeysForProvider,
    getProviderConfig,
    createOpenAIClient,
    type AIProvider,
    type AISettings
} from "./ai";
import { aiLogger } from "./logger";
import {
    VISION_ANALYSIS_SYSTEM_PROMPT,
    CLAUDE_VISION_PROMPT,
    QWEN_VISION_PROMPT
} from "@/config/ai-prompts";
import { extractJsonFromResponse } from "./advisor-utils";

export interface VisionImage {
    data: string; // base64 string (data:image/...)
    angle?: string;
}

const RETRY_DELAY_MS = 1000;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 延迟函数
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 尝试调用AI API
 */
async function tryCallAI(
    client: any,
    messages: any[],
    provider: AIProvider,
    retries: number = 3
): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await client.chat.completions.create({
                model: getVisionModel(provider),
                messages,
                temperature: 0.3,
                max_tokens: 4000,
            });
            return response;
        } catch (error) {
            aiLogger.error(`AI call failed (attempt ${i + 1}):`, error);
            if (i === retries - 1) throw error;
            await delay(RETRY_DELAY_MS * (i + 1));
        }
    }
    throw new Error("All retries failed");
}

/**
 * 构建视觉分析提示词
 */
export function buildVisionPrompt(
    images: VisionImage[],
    context: AnalysisContext
): any[] {
    const systemPrompt = getVisionSystemPrompt();
    
    // 构建多模态消息
    const userContent: any[] = [
        { 
            type: 'text', 
            text: `请分析以下面部照片。用户背景信息：\n\n${JSON.stringify(context, null, 2)}` 
        }
    ];
    
    // 添加所有图像
    images.forEach((image, index) => {
        userContent.push({
            type: 'image_url',
            image_url: {
                url: image.data,
                detail: 'high'
            }
        });
    });
    
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];
}

/**
 * 获取视觉分析系统提示词
 */
export function getVisionSystemPrompt(): string {
    return VISION_ANALYSIS_SYSTEM_PROMPT;
}

// ============================================================================
// 主分析函数
// ============================================================================

/**
 * 视觉分析主函数 (支持多 Key 轮询)
 */
export async function analyzeImages(
    images: VisionImage[],
    context: AnalysisContext,
    retries: number = 0
): Promise<FaceAnalysisResult> {
    if (images.length === 0) {
        throw new Error("至少需要一张面部照片");
    }

    aiLogger.info(`开始分析 ${images.length} 张照片`);
    const startTime = performance.now();

    try {
        // 1. 获取AI设置
        const settings = getAISettings();
        const providers = Object.keys(settings.providers).filter(
            p => settings.providers[p as AIProvider].enabled
        ) as AIProvider[];

        // 2. 遍历可用供应商
        let lastError: Error | null = null;

        for (const provider of providers) {
            try {
                // 2.1 获取API Key
                const apiKey = getApiKeysForProvider(provider);
                if (!apiKey) {
                    aiLogger.warn(`Provider ${provider} has no API key`);
                    continue;
                }

                // 2.2 创建客户端
                const client = createOpenAIClient(provider, apiKey);

                // 2.3 构建提示词
                const messages = buildVisionPrompt(images, context);

                // 2.4 调用AI API
                const response = await tryCallAI(client, messages, provider);

                // 2.5 解析结果
                const result = extractJsonFromResponse(response);
                const normalizedResult = normalizeAnalysisResult(result);

                const duration = performance.now() - startTime;
                aiLogger.info(`Analysis successful in ${duration.toFixed(0)}ms`);

                return normalizedResult;

            } catch (error) {
                lastError = error as Error;
                aiLogger.error(`Provider ${provider} failed:`, error);
                continue;
            }
        }

        // 3. 所有供应商失败，返回降级结果
        aiLogger.error("All providers failed, using fallback");
        return getFallbackAnalysisResult(context);

    } catch (error) {
        aiLogger.error("Analysis failed:", error);
        throw error;
    }
}

// ============================================================================
// 结果标准化
// ============================================================================

/**
 * 标准化分析结果
 */
export function normalizeAnalysisResult(result: any): FaceAnalysisResult {
    // 确保dimensions存在
    if (!result.dimensions) {
        result.dimensions = {};
    }

    // 标准化10维度
    const dimensions = result.dimensions;
    
    return {
        validation: result.validation || {
            isValid: true,
            message: "分析成功"
        },
        skinType: {
            type: result.skinType?.type || "unknown",
            confidence: result.skinType?.confidence || 0.5,
            description: result.skinType?.description || ""
        },
        skinAge: {
            estimated: result.skinAge?.estimated || 25,
            factors: result.skinAge?.factors || []
        },
        gender: result.gender || {
            value: "female",
            confidence: 0.95
        },
        dimensions: {
            waterOil: dimensions.waterOil || createDimensionScore(70),
            pores: dimensions.pores || createDimensionScore(70),
            skinTone: dimensions.skinTone || createDimensionScore(70),
            spots: dimensions.spots || createDimensionScore(70),
            wrinkles: dimensions.wrinkles || createDimensionScore(70),
            skinTypeScore: dimensions.skinTypeScore || createDimensionScore(70),
            uvDamage: dimensions.uvDamage || createDimensionScore(70),
            sensitivity: dimensions.sensitivity || createDimensionScore(70),
            darkCircles: dimensions.darkCircles || createDimensionScore(70),
            firmness: dimensions.firmness || createDimensionScore(70),
            acne: dimensions.acne || createDimensionScore(70),
            radiance: dimensions.radiance || createDimensionScore(70)
        },
        hydration: {
            level: result.hydration?.level || "moderate",
            percent: result.hydration?.percent || 50,
            description: result.hydration?.description || "水分含量适中"
        },
        overallScore: result.overallScore || 70,
        summary: result.summary || "分析完成",
        recommendations: result.recommendations || [],
        skinConditions: result.skinConditions || [],
        zoneAnalysis: result.zoneAnalysis,
        priorityAreas: result.priorityAreas,
        labAnalysis: result.labAnalysis
    };
}

/**
 * 创建维度评分对象
 */
function createDimensionScore(score: number): DimensionScore {
    let grade: "excellent" | "good" | "average" | "fair" | "poor";
    
    if (score >= 90) grade = "excellent";
    else if (score >= 80) grade = "good";
    else if (score >= 70) grade = "average";
    else if (score >= 60) grade = "fair";
    else grade = "poor";

    return {
        score,
        grade,
        details: ""
    };
}

/**
 * 获取降级分析结果
 */
export function getFallbackAnalysisResult(context: AnalysisContext): FaceAnalysisResult {
    return {
        validation: {
            isValid: true,
            message: "AI服务不可用，使用降级分析"
        },
        skinType: {
            type: context.answers.skinType || "unknown",
            confidence: 0.8
        },
        skinAge: {
            estimated: 25,
            factors: []
        },
        gender: {
            value: context.answers.gender as "male" | "female" || "female",
            confidence: 0.95
        },
        dimensions: {
            waterOil: createDimensionScore(70),
            pores: createDimensionScore(70),
            skinTone: createDimensionScore(70),
            spots: createDimensionScore(70),
            wrinkles: createDimensionScore(70),
            skinTypeScore: createDimensionScore(70),
            uvDamage: createDimensionScore(70),
            sensitivity: createDimensionScore(70),
            darkCircles: createDimensionScore(70),
            firmness: createDimensionScore(70),
            acne: createDimensionScore(70),
            radiance: createDimensionScore(70)
        },
        hydration: {
            level: "moderate",
            percent: 50,
            description: "水分含量适中"
        },
        overallScore: 70,
        summary: "降级分析完成",
        recommendations: ["请确保良好的作息和饮食习惯"],
        skinConditions: [],
        zoneAnalysis: undefined,
        priorityAreas: [],
        labAnalysis: undefined
    };
}
```

---

## 第6-10页：AI客户端封装

**文件**：`src/lib/ai.ts`  
**功能**：多AI供应商统一接口

```typescript
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import {
    OpenAI as OpenAIClass,
    Anthropic,
    VertexAI,
} from "@google/generativeai";

// ============================================================================
// 类型定义
// ============================================================================

export type AIProvider = "openai" | "qwen" | "claude" | "gemini";

export interface ProviderConfig {
    enabled: boolean;
    baseUrl?: string;
    model?: string;
    timeout?: number;
}

export interface AISettings {
    providers: {
        openai: ProviderConfig;
        qwen: ProviderConfig;
        claude: ProviderConfig;
        gemini: ProviderConfig;
    };
}

// ============================================================================
// 配置管理
// ============================================================================

/**
 * 获取AI设置
 */
export function getAISettings(): AISettings {
    return {
        providers: {
            openai: {
                enabled: !!process.env.OPENAI_API_KEY,
                baseUrl: "https://api.openai.com/v1",
                model: process.env.OPENAI_VISION_MODEL || "gpt-4o-2024-08-06",
                timeout: 60000,
            },
            qwen: {
                enabled: !!process.env.QWEN_API_KEY,
                baseUrl: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
                model: process.env.QWEN_VISION_MODEL || "qwen-vl-plus",
                timeout: 60000,
            },
            claude: {
                enabled: !!process.env.ANTHROPIC_API_KEY,
                baseUrl: "https://api.anthropic.com/v1",
                model: process.env.CLAUDE_VISION_MODEL || "claude-3-5-sonnet-20240620",
                timeout: 60000,
            },
            gemini: {
                enabled: !!process.env.GEMINI_API_KEY,
                baseUrl: "https://generativelanguage.googleapis.com/v1beta",
                model: process.env.GEMINI_VISION_MODEL || "gemini-1.5-flash",
                timeout: 60000,
            },
        },
    };
}

/**
 * 获取指定供应商的API Key
 */
export function getApiKeysForProvider(provider: AIProvider): string | null {
    switch (provider) {
        case "openai":
            return process.env.OPENAI_API_KEY || null;
        case "qwen":
            return process.env.QWEN_API_KEY || null;
        case "claude":
            return process.env.ANTHROPIC_API_KEY || null;
        case "gemini":
            return process.env.GEMINI_API_KEY || null;
        default:
            return null;
    }
}

/**
 * 获取指定供应商的模型名
 */
export function getVisionModel(provider: AIProvider): string {
    const settings = getAISettings();
    return settings.providers[provider].model || getFallbackModel(provider);
}

function getFallbackModel(provider: AIProvider): string {
    switch (provider) {
        case "openai":
            return "gpt-4o-2024-08-06";
        case "qwen":
            return "qwen-vl-plus";
        case "claude":
            return "claude-3-5-sonnet-20240620";
        case "gemini":
            return "gemini-1.5-flash";
        default:
            return "gpt-4o-2024-08-06";
    }
}

// ============================================================================
// 客户端创建
// ============================================================================

/**
 * 创建OpenAI客户端
 */
export function createOpenAIClient(
    provider: AIProvider,
    apiKey: string
): OpenAI {
    const settings = getAISettings();
    const providerConfig = settings.providers[provider];

    const client = new OpenAI({
        apiKey,
        baseURL: providerConfig.baseUrl,
        timeout: providerConfig.timeout,
        maxRetries: 2,
    });

    return client;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 解析AI响应中的JSON
 */
export function extractJsonFromResponse(response: any): any {
    const content = response.choices?.[0]?.message?.content || "";
    
    // 尝试提取JSON
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析
    try {
        return JSON.parse(content);
    } catch {
        // 如果不是JSON，返回原始内容
        return { raw: content };
    }
}

/**
 * 获取可用供应商列表
 */
export function getAvailableProviders(): AIProvider[] {
    const settings = getAISettings();
    return (Object.keys(settings.providers) as AIProvider[])
        .filter(p => settings.providers[p].enabled);
}
```

---

## 第11-15页：MediaPipe Face Mesh初始化

**文件**：`src/lib/mediapipe-utils.ts`  
**功能**：468点高精度FaceMesh单例初始化

```typescript
/**
 * MediaPipe Face Mesh 工具库 (VIP 专属高级分析引擎)
 *
 * 功能：
 * - 单例模式初始化 FaceLandmarker (468 点高精度面部网格)
 * - 本地化 WASM + 模型文件 (不依赖 Google CDN，适配国内网络)
 * - 延迟加载：仅在 VIP 用户需要时初始化
 * - 优雅降级：初始化失败不阻塞主流程
 *
 * 与现有 face-api (68点) 的关系：
 * - face-api: 基础层，用于 FaceCapture 拍照环节（所有用户）
 * - MediaPipe: 高级层，用于 Result 页 AR 热力图与轮廓分析（VIP 专属）
 */

import {
    FaceLandmarker,
    FilesetResolver,
    type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

// ============================================================================
// 类型定义
// ============================================================================

/** 初始化状态 */
type InitStatus = "idle" | "loading" | "ready" | "error";

/** 简化的关键点坐标 */
export interface LandmarkPoint {
    x: number; // 归一化 0~1
    y: number;
    z: number;
}

/** 面部网格检测结果 (简化版) */
export interface FaceMeshResult {
    /** 468 个面部关键点 (归一化坐标) */
    landmarks: LandmarkPoint[];
    /** 面部变换矩阵 (用于 3D 姿态估计) */
    facialTransformationMatrix?: Float32Array;
    /** 面部混合形状 (表情系数，如微笑、眨眼) */
    blendshapes?: Record<string, number>;
    /** 原始 MediaPipe 结果 (高级用途) */
    raw: FaceLandmarkerResult;
}

// ============================================================================
// 配置常量
// ============================================================================

/** 本地化模型文件路径（相对于 public 目录） */
const WASM_PATH = "/models/mediapipe/wasm";
const MODEL_PATH = "/models/mediapipe/face_landmarker.task";

/**
 * 初始化超时 (毫秒)
 */
const INIT_TIMEOUT = 15000;

// ============================================================================
// 单例管理器
// ============================================================================

let faceLandmarker: FaceLandmarker | null = null;
let initStatus: InitStatus = "idle";
let initPromise: Promise<FaceLandmarker | null> | null = null;

/**
 * 获取当前初始化状态
 */
export function getMediaPipeStatus(): InitStatus {
    return initStatus;
}

/**
 * 获取 FaceLandmarker 实例
 */
export function getFaceLandmarker(): FaceLandmarker | null {
    return faceLandmarker;
}

/**
 * 重置初始化状态
 */
export function resetMediaPipe() {
    faceLandmarker = null;
    initStatus = "idle";
    initPromise = null;
}
```

---

## 第16-20页：MediaPipe Face Mesh初始化继续

**文件**：`src/lib/mediapipe-utils.ts`（继续）  
**功能**：单例初始化实现

```typescript
/**
 * 初始化 MediaPipe FaceLandmarker (单例)
 *
 * 特性：
 * - 多次调用安全：相同的 Promise 会被复用
 * - 本地化部署：WASM 和模型从 public 目录加载
 * - 超时保护：避免无限等待
 *
 * @returns FaceLandmarker 实例或 null (失败时)
 */
export async function initFaceLandmarker(): Promise<FaceLandmarker | null> {
    // 已就绪，直接返回
    if (initStatus === "ready" && faceLandmarker) {
        return faceLandmarker;
    }

    // 正在加载，复用同一个 Promise
    if (initStatus === "loading" && initPromise) {
        return initPromise;
    }

    // 开始初始化
    initStatus = "loading";

    initPromise = (async () => {
        try {
            console.log("[MediaPipe] 正在初始化 FaceLandmarker...");
            const startTime = performance.now();

            // 1. 加载 WASM 运行时 (从本地 public 目录)
            const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
            console.log("[MediaPipe] WASM 加载完成");

            // 2. 创建 FaceLandmarker (从本地模型)
            faceLandmarker = await FaceLandmarker.createFromModelPath(
                vision,
                MODEL_PATH
            );
            console.log("[MediaPipe] FaceLandmarker 创建完成");

            // 3. 验证初始化
            if (!faceLandmarker) {
                throw new Error("FaceLandmarker 创建失败");
            }

            const duration = performance.now() - startTime;
            console.log(`[MediaPipe] 初始化完成，耗时: ${duration.toFixed(0)}ms`);
            initStatus = "ready";

            return faceLandmarker;

        } catch (error) {
            console.error("[MediaPipe] 初始化失败:", error);
            initStatus = "error";
            resetMediaPipe();
            return null;
        }
    })();

    // 添加超时保护
    const timeoutPromise = new Promise<FaceLandmarker | null>((resolve) => {
        setTimeout(() => {
            console.warn("[MediaPipe] 初始化超时");
            initStatus = "error";
            resetMediaPipe();
            resolve(null);
        }, INIT_TIMEOUT);
    });

    return Promise.race([initPromise, timeoutPromise]);
}

/**
 * 检测面部网格
 *
 * 使用示例：
 * ```typescript
 * const landmarker = await initFaceLandmarker();
 * if (landmarker) {
 *     const result = await detectFaceMesh(imageSource);
 *     console.log(result.landmarks); // 468 个关键点
 * }
 * ```
 *
 * @param imageSource 图像源 (HTMLElement | ImageSource)
 * @returns FaceMeshResult 或 null
 */
export async function detectFaceMesh(
    imageSource: HTMLElement | ImageSource
): Promise<FaceMeshResult | null> {
    const landmarker = await initFaceLandmarker();
    
    if (!landmarker) {
        console.error("[MediaPipe] FaceLandmarker 未初始化");
        return null;
    }

    try {
        const result = await landmarker.detect(imageSource);
        
        if (!result.face_landmarks || result.face_landmarks.length === 0) {
            console.warn("[MediaPipe] 未检测到面部");
            return null;
        }

        // 转换为简化格式
        const landmarks = result.face_landmarks[0].map((point) => ({
            x: point.x,
            y: point.y,
            z: point.z,
        }));

        return {
            landmarks,
            facialTransformationMatrix: result.facial_transformation_matrix,
            blendshapes: result.blend_shapes,
            raw: result,
        };

    } catch (error) {
        console.error("[MediaPipe] 检测失败:", error);
        return null;
    }
}
```

---

## 第21-25页：区域映射与热力图

**文件**：`src/lib/face-zones.ts`  
**功能：478顶点区域映射与热力图引擎

```typescript
/**
 * MediaPipe Face Mesh 区域映射与数据处理引擎 (最高精度版)
 *
 * 功能：
 * 1. VERTEX_ZONE_MAP: 定义 478 个顶点分别属于哪个皮肤区域 (Forehead, Cheek, etc.)
 * 2. buildTrianglesFromConnections: 从边列表重建三角形拓扑
 * 3. getTriangleZone: 判定三角形所属区域
 * 4. getZoneScore: 按维度提取评分
 * 5. scoreToColor: 高级 HSL 颜色插值引擎
 */

import type { ZoneData } from "./advisor-utils";

// ============================================================================
// 1. 类型定义
// ============================================================================

export type ZoneKey = 
    | "forehead"    // 额头
    | "tZone"       // T区
    | "leftCheek"   // 左脸颊
    | "rightCheek"  // 右脸颊
    | "eyeArea"     // 眼周
    | "jawline";    // 下颌线

export type DimensionKey = 
    | "overall" 
    | "oil" 
    | "pores" 
    | "wrinkles" 
    | "spots" 
    | "acne" 
    | "darkCircles";

// ============================================================================
// 2. 顶点 -> 区域映射表 (MediaPipe 478点拓扑)
// ============================================================================

/**
 * 顶点的区域归属表 (Index -> ZoneKey | null)
 * 支持 478 个点 (468 标准 + 10 虹膜)
 * null 表示该点位于边界或非核心区域（如嘴唇内部、眼球表面），不参与热力渲染
 */
const VERTEX_ZONE_MAP: (ZoneKey | null)[] = new Array(478).fill(null);

/**
 * 区域定义
 */
const ZONE_INDICES: Record<ZoneKey, number[]> = {
    forehead: [],
    tZone: [],
    leftCheek: [],
    rightCheek: [],
    eyeArea: [],
    jawline: [],
};

/**
 * 初始化区域映射 (基于 MediaPipe 官方拓扑)
 * 注意：这是一份精简后的关键区域映射，确保热力图只覆盖皮肤核心区
 */
function initVertexMap() {
    // -------------------------------------------------------------------------
    // 0. 预定义排他性区域 (用于后续过滤)
    // -------------------------------------------------------------------------
    // 鼻子/T区核心点 (用于防止下颌/脸颊覆盖)
    const tZoneCoreIndices = [1, 4, 19, 94, 2, 49, 131, 134, 5, 275, 456, 363, 6, 197, 168, 193, 245, 122, 196, 3, 51, 45, 4, 275, 442, 281, 285];

    // 1. 额头区域 (Forehead) - 向上延伸至发际线
    const foreheadIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10,];
    foreheadIndices.forEach(idx => VERTEX_ZONE_MAP[idx] = "forehead");

    // 2. T 区 (T-Zone) - 眉心 + 鼻子
    const tZoneIndices = [...tZoneCoreIndices, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 97, 326, 327, 294, 278, 344, 440, 275, 456, 399, 419, 196, 197];
    tZoneIndices.forEach(idx => VERTEX_ZONE_MAP[idx] = "tZone");

    // 3. 左右脸颊 (Cheeks)
    const leftCheekIndices = [123, 147, 213, 192, 214, 210, 211, 32, 208, 199, 428, 416, 434, 432, 422, 430, 431, 410, 423, 391, 322, 411, 215, 187, 207, 216, 212, 210];
    leftCheekIndices.forEach(idx => VERTEX_ZONE_MAP[idx] = "leftCheek");

    const rightCheekIndices = [352, 376, 433, 416, 434, 430, 431, 262, 428, 421, 208, 196, 121, 115, 131, 128, 116, 123, 147, 213, 192, 214, 210, 211, 117, 118, 119, 120, 121];
    rightCheekIndices.forEach(idx => VERTEX_ZONE_MAP[idx] = "rightCheek");

    // 4. 眼周 (Eye Area)
    const eyeIndices = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
    eyeIndices.forEach(idx => VERTEX_ZONE_MAP[idx] = "eyeArea");

    // 5. 下颌线 (Jawline)
    const jawIndices = [172, 136, 150, 149, 148, 152, 377, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 338, 10, 68, 71, 139, 162, 127, 234, 93, 132, 58];
    jawIndices.forEach(idx => VERTEX_ZONE_MAP[idx] = "jawline");

    // 将结果存入索引表方便查询
    Object.keys(ZONE_INDICES).forEach(key => {
        const zoneKey = key as ZoneKey;
        VERTEX_ZONE_MAP.forEach((val, idx) => {
            if (val === zoneKey) ZONE_INDICES[zoneKey].push(idx);
        });
    });
}

// 初始化
initVertexMap();

// ============================================================================
// 3. 工具函数
// ============================================================================

/**
 * 获取特定区域的评分
 */
export function getZoneScore(
    result: FaceAnalysisResult,
    zone: ZoneKey,
    dimension: DimensionKey = "overall"
): number {
    const zoneData = result.zoneAnalysis?.[zone];
    if (!zoneData) return 70; // 默认中等分数

    switch (dimension) {
        case "oil": return zoneData.oil ?? 70;
        case "pores": return zoneData.pores ?? 70;
        case "wrinkles": return zoneData.wrinkles ?? 70;
        case "spots": return zoneData.spots ?? 70;
        case "acne": return zoneData.acne ?? 70;
        case "darkCircles": return zoneData.darkCircles ?? 70;
        default: return result.overallScore;
    }
}

/**
 * 评分转换颜色 (HSL 模式)
 * 0: 红色 (差)
 * 60: 黄色 (中)
 * 120: 绿色 (优)
 */
export function scoreToHSL(score: number): string {
    // 限制分数范围
    const s = Math.max(0, Math.min(100, score));
    
    // 绿色(120) -> 红色(0) 的渐变
    // 注意：在皮肤热力图中，通常 100分(好)对应绿色，0分(差)对应红色
    const hue = (s / 100) * 120;
    
    return `hsl(${hue}, 80%, 50%)`;
}

/**
 * 计算区域边界 (Bounding Box)
 */
export function getZoneBounds(landmarks: LandmarkPoint[], zone: ZoneKey) {
    const indices = ZONE_INDICES[zone];
    if (indices.length === 0) return null;

    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    indices.forEach(idx => {
        const p = landmarks[idx];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    });

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
```

---

## 第31-35页：面部区域着色引擎

**文件**：`src/lib/face-zones.ts`（继续）  
**功能**：Mesh 三角形构建与着色算法

```typescript
/**
 * 构建网格三角形 (基于连接列表)
 * @param connections MediaPipe 提供的线框连接
 */
export function buildTrianglesFromConnections(
    connections: number[][]
): number[][] {
    const triangles: number[][] = [];
    // 这是一个简化版的三角剖分逻辑
    // 在实际 WebGL 渲染中，通常使用预定义的拓扑索引
    for (let i = 0; i < connections.length; i += 2) {
        const p1 = connections[i][0];
        const p2 = connections[i][1];
        const p3 = connections[i+1]?.[0] || connections[0][0];
        triangles.push([p1, p2, p3]);
    }
    return triangles;
}

/**
 * 判定三角形所属区域 (采用多数投票原则)
 */
export function getTriangleZone(triangle: number[]): ZoneKey | null {
    const votes: Record<string, number> = {};
    
    triangle.forEach(idx => {
        const zone = VERTEX_ZONE_MAP[idx];
        if (zone) {
            votes[zone] = (votes[zone] || 0) + 1;
        }
    });

    // 找到票数最多的区域
    let maxVotes = 0;
    let winner: ZoneKey | null = null;
    
    for (const [zone, count] of Object.entries(votes)) {
        if (count > maxVotes) {
            maxVotes = count;
            winner = zone as ZoneKey;
        }
    }

    return winner;
}

/**
 * 渲染热力图网格
 */
export function drawHeatmap(
    ctx: CanvasRenderingContext2D,
    landmarks: LandmarkPoint[],
    result: FaceAnalysisResult,
    dimension: DimensionKey
) {
    // 1. 获取三角形列表 (预定义)
    const triangles = getBuiltInTriangles();
    
    // 2. 遍历渲染
    triangles.forEach(tri => {
        const zone = getTriangleZone(tri);
        if (!zone) return; // 忽略嘴部、眼球等非皮肤区

        const score = getZoneScore(result, zone, dimension);
        ctx.fillStyle = scoreToHSL(score);
        ctx.strokeStyle = "rgba(255,255,255,0.1)";

        ctx.beginPath();
        const p0 = landmarks[tri[0]];
        ctx.moveTo(p0.x * ctx.canvas.width, p0.y * ctx.canvas.height);
        
        for (let i = 1; i < tri.length; i++) {
            const p = landmarks[tri[i]];
            ctx.lineTo(p.x * ctx.canvas.width, p.y * ctx.canvas.height);
        }
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });
}

function getBuiltInTriangles() {
    // 这里返回 MediaPipe 预定义的三角面索引 (简化)
    return [[0, 1, 2], [1, 2, 3], /* ... 几百个面 */];
}
```

---

## 第36-40页：AI 提示词配置 (后 30 页起始)

**文件**：`src/config/ai-prompts.ts`  
**功能**：MySkin.Technology 风格 10 维度分析 Prompt

```typescript
/**
 * AI 提示词配置 (MySkin.Technology 风格)
 * 提取品牌元素为配置变量，支持作为独立产品输出
 */

export const BRAND_CONFIG = {
  name: "旎柏AI护肤顾问系统",
  advisorName: "智能护肤顾问",
  tone: "professional", // professional | friendly | luxury
};

// ============================================================================
// MySkin.Technology 风格 10 维度面部分析提示词 (GPT-4V / Qwen-VL)
// ============================================================================

export const VISION_ANALYSIS_SYSTEM_PROMPT = `你是一位专业的皮肤科医生和${BRAND_CONFIG.advisorName}。这是 MySkin.Technology 风格的专业皮肤分析。

# 📊 MySkin.Technology 风格 10 维度分析系统
请对上传的面部照片进行综合分析，评估以下 12 个核心维度（每个维度评分 0-100，越高越好，即问题越少分数越高）：

1. **waterOil (水油平衡)**: 皮肤水分与油脂分泌的平衡状态
2. **pores (毛孔)**: 毛孔大小、分布及清晰度
3. **skinTone (肤色均匀)**: 肤色整体均匀度，有无局部暗沉
4. **spots (色斑)**: 表面可见色斑、晒斑及色素沉着
5. **wrinkles (皱纹)**: 面部干纹、细纹及深层皱纹状态
6. **skinTypeScore (肤质分型)**: 皮肤生理类型的稳定性评分
7. **uvDamage (光损伤)**: 紫外线造成的深层光老化损伤
8. **sensitivity (敏感度)**: 皮肤屏障功能及耐受度（红区、敏感）
9. **darkCircles (黑眼圈)**: 眼周色素沉着及循环状况
10. **firmness (皮肤弹性)**: 胶原蛋白支撑力及皮肤紧致度
11. **acne (痘痘)**: 痤疮炎症、粉刺情况
12. **radiance (光泽度)**: 皮肤透亮程度、光泽感

# 📈 评分标准
- 90-100:  excellent (优秀) - 皮肤状态极佳
- 80-89:   good (良好) - 皮肤状态良好
- 70-79:   average (中等) - 皮肤状态一般
- 60-69:   fair (较差) - 存在明显问题
- 0-59:    poor (很差) - 问题严重

# 🏺 输出格式
请以 JSON 格式返回分析结果，确保包含以下字段：

{
  "validation": {
    "isValid": boolean,
    "message": "string"
  },
  "skinType": {
    "type": "dry" | "oily" | "combination_dry" | "combination_oily" | "sensitive" | "normal" | "unknown",
    "confidence": number (0-1),
    "description": "string"
  },
  "skinAge": {
    "estimated": number (实际年龄±5),
    "factors": ["string"] (影响因素列表)
  },
  "gender": {
    "value": "male" | "female",
    "confidence": number (0-1)
  },
  "dimensions": {
    "waterOil": {"score": 0-100, "grade": "excellent"|"good"|"average"|"fair"|"poor", "details": "string"},
    "pores": {"score": 0-100, "grade": "...", "details": "..."},
    ...
  },
  "hydration": {
    "level": "low" | "moderate" | "high",
    "percent": number (0-100),
    "description": "string"
  },
  "overallScore": number (0-100),
  "summary": "string",
  "recommendations": ["string"], (至少 5 条)
  "skinConditions": [
    {
      "condition": "string",
      "severity": "mild" | "moderate" | "severe",
      "area": "string",
      "description": "string"
    }
  ],
  "zoneAnalysis": {
    "forehead": ZoneData,
    "tZone": ZoneData,
    "leftCheek": ZoneData,
    "rightCheek": ZoneData,
    "eyeArea": ZoneData,
    "jawline": ZoneData
  },
  "priorityAreas": ["string"], (最多 3 个关键区域)
  "labAnalysis": {
    "skinPh": {"value": 3.5-7.0, "range": "3.5-5.5", "status": "normal"|"low"|"high"},
    "tewl": {"value": 2-20, "unit": "g/m²/h", "status": "normal"|"low"|"high"},
    "elasticity": {"value": 0-100, "unit": "R2", "status": "normal"|"low"|"high"},
    "melanin": {"value": 0-100, "unit": "MI", "status": "normal"|"high"},
    "erythema": {"value": 0-100, "unit": "EI", "status": "normal"|"high"},
    "glogau": {"value": "I"|"II"|"III"|"IV", "status": "string"}
  }
}

# 📌 注意事项
1. 所有维度评分必须在 0-100 之间
2. grade 必须是 5 个可选值之一
3. skinType 必须从 6 个选项中选择
4. 评分应基于照片可见特征，而非用户问卷
5. 如果某些维度无法评估，使用中等分数 (70) 并标注说明
6. zoneAnalysis 的每个区域必须包含 condition, advice, 和 6 个指标

现在请分析上传的面部照片：`;
```

---

## 第41-45页：数据分析结构定义

**文件**：`src/lib/advisor-utils.ts`  
**功能**：10维度分析结果类型定义

```typescript
/**
 * MySkin.Technology 风格 10 维度面部分析类型定义
 */

export interface DimensionScore {
    score: number;
    percentile?: number;
    grade: "excellent" | "good" | "average" | "fair" | "poor";
    details: string;
}

// ============================================================================
// 区域分析数据结构
// ============================================================================

/**
 * 单个区域分析数据
 */
export interface ZoneData {
    condition: string; // 该区域存在的问题
    advice: string;    // 针对该区域的建议
    // 详细指标 (0-100)
    wrinkles?: number;
    oil?: number;
    texture?: number;
    pores?: number;
    spots?: number;
    redness?: number;
    darkCircles?: number;
    firmness?: number;
    contour?: number;
}

/**
 * 六大区域分析结果
 */
export interface ZoneAnalysis {
    forehead: ZoneData;
    tZone: ZoneData;
    leftCheek: ZoneData;
    rightCheek: ZoneData;
    eyeArea: ZoneData;
    jawline: ZoneData;
}

// ============================================================================
// 皮肤问题数据结构
// ============================================================================

/**
 * 皮肤问题定义
 */
export interface SkinCondition {
    condition: string;
    severity: "mild" | "moderate" | "severe";
    area: string;
    description: string;
}

// ============================================================================
// 主分析结果类型
// ============================================================================

/**
 * 完整的分析结果类型
 */
export interface FaceAnalysisResult {
    validation?: {
        isValid: boolean;
        message: string;
    };
    skinType: {
        type: string;
        confidence: number;
        description?: string;
    };
    skinAge: {
        estimated: number;
        factors: string[];
    };
    gender?: {
        value: "male" | "female";
        confidence: number;
    };
    dimensions: {
        waterOil: DimensionScore;
        pores: DimensionScore;
        skinTone: DimensionScore;
        spots: DimensionScore;
        wrinkles: DimensionScore;
        skinTypeScore: DimensionScore;
        uvDamage: DimensionScore;
        sensitivity: DimensionScore;
        darkCircles: DimensionScore;
        firmness: DimensionScore;
        acne: DimensionScore;
        radiance: DimensionScore;
    };
    hydration: {
        level: string;
        percent?: number;
        description: string;
    };
    overallScore: number;
    summary: string;
    recommendations: string[];
    skinConditions: SkinCondition[];
    zoneAnalysis?: ZoneAnalysis;
    priorityAreas?: string[];
    labAnalysis?: LabAnalysisResult;
}
```

---

## 第46-50页：环境感知推荐

**文件**：`src/lib/env-recommendation.ts`  
**功能**：结合天气数据的动态护肤方案

```typescript
/**
 * 环境感知护肤推荐引擎
 */

import { getCoordinatesByRegion } from "./geoip";

export interface ClimateData {
    uvIndex: number;           // UV指数
    humidity: number;          // 相对湿度
    weatherCode: number;       // 天气代码
    pressure: number;          // 气压
    cloudCover: number;        // 云量
}

const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
    "北京": { lat: 39.9042, lon: 116.4074 },
    "上海": { lat: 31.2304, lon: 121.4737 },
    "广州": { lat: 23.1291, lon: 113.2644 },
    "深圳": { lat: 22.5431, lon: 114.0579 },
};

/**
 * 获取地区天气数据 (使用 Open-Meteo)
 */
export async function getClimateByRegion(region: string): Promise<ClimateData> {
    const coords = CITY_COORDINATES[region] || CITY_COORDINATES["北京"];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=uv_index,relative_humidity_2m`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return {
        uvIndex: data.current.uv_index,
        humidity: data.current.relative_humidity_2m,
        weatherCode: 0,
        pressure: 0,
        cloudCover: 0
    };
}

/**
 * 动态调整建议
 */
export function adjustRecommendations(
    baseRecs: string[],
    climate: ClimateData
): string[] {
    const finalRecs = [...baseRecs];
    
    // UV 提醒
    if (climate.uvIndex >= 6) {
        finalRecs.unshift("[!] 今日紫外线强度高，请务必涂抹 SPF50+ 防晒霜并物理遮蔽。");
    } else if (climate.uvIndex >= 3) {
        finalRecs.unshift("[!] 今日有中等紫外线，建议涂抹防晒霜。");
    }
    
    // 湿度提醒
    if (climate.humidity < 40) {
        finalRecs.push("[提示] 环境干燥，建议增加面霜/精油使用量，加强屏障修护。");
    } else if (climate.humidity > 80) {
        finalRecs.push("[提示] 环境潮湿，建议使用清爽型乳液，避免过于厚重导致的闷痘。");
    }
    
    return finalRecs;
}
```

---

## 第51-60页：护肤方案生成逻辑

**文件**：`src/lib/skincare-dosage.ts`  
**功能**：个性化 AM/PM 护肤流程生成

```typescript
/**
 * 护肤方案生成逻辑
 */

export interface Product {
    id: string;
    name: string;
    category: string;
}

export interface SkincareRoutine {
    am: Product[];
    pm: Product[];
}

/**
 * 方案生成函数
 */
export function generateSkincareRoutines(
    analysis: FaceAnalysisResult,
    inventory: Product[]
): SkincareRoutine {
    const am: Product[] = [];
    const pm: Product[] = [];
    
    // 基础流程：洁面 -> 水 -> 精华 -> 乳/霜 -> 防晒
    const cleanse = inventory.find(p => p.category === "cleanser");
    const toner = inventory.find(p => p.category === "toner");
    const serum = inventory.find(p => p.category === "serum");
    const cream = inventory.find(p => p.category === "moisturizer");
    const sun = inventory.find(p => p.category === "sunscreen");

    if (cleanse) { am.push(cleanse); pm.push(cleanse); }
    if (toner) { am.push(toner); pm.push(toner); }
    if (serum) { am.push(serum); pm.push(serum); }
    if (cream) { am.push(cream); pm.push(cream); }
    if (sun) { am.push(sun); }

    return { am, pm };
}

/**
 * 品牌名称获取
 */
export function getSystemBrand() {
    return "智能护肤顾问系统";
}
```
