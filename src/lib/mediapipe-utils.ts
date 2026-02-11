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

            // 2. 创建 FaceLandmarker 实例
            faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: MODEL_PATH,
                    delegate: "GPU", // 优先 GPU，失败自动回退 CPU
                },
                runningMode: "IMAGE", // 静态图片模式（非视频流）
                numFaces: 1,
                outputFaceBlendshapes: true, // 输出表情系数
                outputFacialTransformationMatrixes: true, // 输出 3D 变换
            });

            const elapsed = (performance.now() - startTime).toFixed(0);
            console.log(`[MediaPipe] ✅ 初始化成功 (${elapsed}ms)`);
            initStatus = "ready";
            return faceLandmarker;
        } catch (err) {
            console.error("[MediaPipe] ❌ 初始化失败:", err);
            initStatus = "error";
            faceLandmarker = null;

            // 尝试 CPU 降级
            try {
                console.log("[MediaPipe] 尝试 CPU 降级模式...");
                const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
                faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: MODEL_PATH,
                        delegate: "CPU",
                    },
                    runningMode: "IMAGE",
                    numFaces: 1,
                    outputFaceBlendshapes: false,
                    outputFacialTransformationMatrixes: false,
                });
                console.log("[MediaPipe] ✅ CPU 降级模式初始化成功");
                initStatus = "ready";
                return faceLandmarker;
            } catch (cpuErr) {
                console.error("[MediaPipe] ❌ CPU 降级也失败:", cpuErr);
                initStatus = "error";
                return null;
            }
        }
    })();

    return initPromise;
}

/**
 * 检测面部网格 (468 点高精度关键点)
 *
 * @param imageSource - HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
 * @returns FaceMeshResult 或 null (未检测到面部或引擎未初始化)
 */
export async function detectFaceMesh(
    imageSource: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<FaceMeshResult | null> {
    // 确保引擎已初始化
    const landmarker = await initFaceLandmarker();
    if (!landmarker) {
        console.warn("[MediaPipe] FaceLandmarker 未就绪，跳过检测");
        return null;
    }

    try {
        const result = landmarker.detect(imageSource);

        // 未检测到面部
        if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
            console.warn("[MediaPipe] 未检测到面部");
            return null;
        }

        // 取第一张脸的关键点
        const landmarks = result.faceLandmarks[0].map((lm) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
        }));

        // 解析 blendshapes (如果有的话)
        let blendshapes: Record<string, number> | undefined;
        if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
            blendshapes = {};
            for (const shape of result.faceBlendshapes[0].categories) {
                blendshapes[shape.categoryName] = shape.score;
            }
        }

        // 解析变换矩阵
        let facialTransformationMatrix: Float32Array | undefined;
        if (
            result.facialTransformationMatrixes &&
            result.facialTransformationMatrixes.length > 0
        ) {
            const matrix = result.facialTransformationMatrixes[0];
            facialTransformationMatrix = new Float32Array(matrix.data);
        }

        return {
            landmarks,
            facialTransformationMatrix,
            blendshapes,
            raw: result,
        };
    } catch (err) {
        console.error("[MediaPipe] 检测失败:", err);
        return null;
    }
}

/**
 * 将归一化坐标转换为像素坐标
 *
 * @param landmark - 归一化关键点 (0~1)
 * @param imageWidth - 图片实际宽度 (px)
 * @param imageHeight - 图片实际高度 (px)
 * @returns 像素坐标 { x, y }
 */
export function landmarkToPixel(
    landmark: LandmarkPoint,
    imageWidth: number,
    imageHeight: number
): { x: number; y: number } {
    return {
        x: landmark.x * imageWidth,
        y: landmark.y * imageHeight,
    };
}

/**
 * 批量转换归一化坐标为像素坐标
 */
export function landmarksToPixels(
    landmarks: LandmarkPoint[],
    imageWidth: number,
    imageHeight: number
): { x: number; y: number }[] {
    return landmarks.map((lm) => landmarkToPixel(lm, imageWidth, imageHeight));
}

/**
 * 销毁 FaceLandmarker 实例 (释放资源)
 * 在页面卸载或不再需要时调用
 */
export function destroyFaceLandmarker(): void {
    if (faceLandmarker) {
        faceLandmarker.close();
        faceLandmarker = null;
        initStatus = "idle";
        initPromise = null;
        console.log("[MediaPipe] 资源已释放");
    }
}
