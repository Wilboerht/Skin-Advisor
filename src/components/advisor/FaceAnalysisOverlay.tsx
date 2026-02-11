"use client";

import { useEffect, useRef, useState } from "react";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import {
    detectFaceMesh,
    type FaceMeshResult,
} from "@/lib/mediapipe-utils";
import {
    buildMeshTriangles,
    getTriangleZone,
    getZoneScore,
    scoreToColor,
    getVertexZone,
    refineVertexMap,
    type DimensionKey,
    type ZoneKey,
} from "@/lib/face-zones";
import type { ZoneAnalysis } from "@/lib/advisor-utils";
import { cn } from "@/lib/utils";

interface FaceAnalysisOverlayProps {
    imageUrl: string;
    zoneAnalysis: ZoneAnalysis | undefined;
    activeDimension?: DimensionKey;
    showContours?: boolean;
    className?: string;
    onZoneClick?: (zone: ZoneKey) => void;
}

/**
 * 核心 AR 热力图渲染组件
 *
 * 架构设计：
 * 1. Base Image: 原始用户人像
 * 2. Heatmap Canvas (Layer 1): 模糊的色彩热力图 (blur-2xl)
 * 3. Contour Canvas (Layer 2): 清晰的网格线条与五官轮廓 (无模糊)
 * 4. Interaction Layer (Layer 3): 处理点击事件
 */
export function FaceAnalysisOverlay({
    imageUrl,
    zoneAnalysis,
    activeDimension = "overall",
    showContours = true,
    className = "",
    onZoneClick,
}: FaceAnalysisOverlayProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const heatmapRef0 = useRef<HTMLCanvasElement>(null);
    const heatmapRef1 = useRef<HTMLCanvasElement>(null);
    const contourRef = useRef<HTMLCanvasElement>(null);

    const [isLoaded, setIsLoaded] = useState(false);
    const [meshResult, setMeshResult] = useState<FaceMeshResult | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    // 双缓冲状态: 0 或 1 代表当前显示哪一层
    const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
    // 用于在 effect 内部逻辑判断当前绘制目标层，避免 activeLayer 成为 effect 依赖导致死循环
    const activeLayerLogicRef = useRef<0 | 1>(0);
    // 缓存三角形数据，避免每次维度切换都重新获取
    const trianglesRef = useRef<[number, number, number][] | null>(null);

    // 1. 初始化与检测
    useEffect(() => {
        if (!imgRef.current || !imageUrl) return;

        let cancelled = false;

        const runDetection = async () => {
            if (!imgRef.current) return;

            // 确保图片已加载 (处理加载失败的情况)
            if (!imgRef.current.complete) {
                try {
                    await new Promise<void>((resolve, reject) => {
                        imgRef.current!.onload = () => resolve();
                        imgRef.current!.onerror = () => reject(new Error("Image failed to load"));
                    });
                } catch (err) {
                    console.error("[Overlay] Image load failed:", err);
                    return;
                }
            }

            if (cancelled) return;

            // 设置画布尺寸匹配图片实际显示尺寸
            // 注意：MediaPipe 坐标是归一化的，所以只需画布分辨率比例正确即可
            // 这里我们让 canvas 分辨率等于图片自然分辨率，通过 CSS 布局缩放
            const naturalWidth = imgRef.current.naturalWidth;
            const naturalHeight = imgRef.current.naturalHeight;

            if (naturalWidth === 0 || naturalHeight === 0) return; // 图片无效

            setCanvasSize({ width: naturalWidth, height: naturalHeight });

            try {
                // 运行 MediaPipe 面部网格检测
                const result = await detectFaceMesh(imgRef.current);
                if (!cancelled && result) {
                    setMeshResult(result);
                    setIsLoaded(true);
                }
            } catch (error) {
                console.error("[Overlay] Detection failed:", error);
            }
        };

        runDetection();

        return () => {
            cancelled = true;
        };
    }, [imageUrl]);

    // 2. 渲染热力图 (Heatmap Layer) - 双缓冲绘制
    useEffect(() => {
        if (!meshResult || !zoneAnalysis) return;

        // 确定正在绘制的目标层 (非当前显示层)
        const targetLayer = activeLayerLogicRef.current === 0 ? 1 : 0;
        const targetCanvas = targetLayer === 0 ? heatmapRef0.current : heatmapRef1.current;

        if (!targetCanvas) return;

        const ctx = targetCanvas.getContext("2d");
        if (!ctx) return;

        const { width, height } = canvasSize;
        if (width === 0 || height === 0) return;

        // 设置目标 Canvas 分辨率
        targetCanvas.width = width;
        targetCanvas.height = height;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        const landmarks = meshResult.landmarks;
        const landmarkCount = landmarks.length;

        // 获取/缓存三角形数据 (仅首次计算)
        if (!trianglesRef.current) {
            const connections = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
            // 基于拓扑自动填充映射表空洞，确保热力图饱满
            refineVertexMap(connections);
            // 重建三角形
            trianglesRef.current = buildMeshTriangles(connections);
        }
        const triangles = trianglesRef.current;

        ctx.save();
        // 渲染三角形
        triangles.forEach(([i1, i2, i3]) => {
            // 越界保护：确保索引在 landmarks 范围内
            if (i1 >= landmarkCount || i2 >= landmarkCount || i3 >= landmarkCount) return;

            const p1 = landmarks[i1];
            const p2 = landmarks[i2];
            const p3 = landmarks[i3];

            // 判定区域
            const zone = getTriangleZone(i1, i2, i3);
            if (!zone) return;

            // 获取该区域的分数 (zone 已是 ZoneKey，无需额外断言)
            const currentZoneData = zoneAnalysis[zone];
            if (!currentZoneData) return;

            const score = getZoneScore(currentZoneData, activeDimension);
            const color = scoreToColor(score);

            ctx.beginPath();
            ctx.moveTo(p1.x * width, p1.y * height);
            ctx.lineTo(p2.x * width, p2.y * height);
            ctx.lineTo(p3.x * width, p3.y * height);
            ctx.closePath();

            ctx.fillStyle = color;
            ctx.fill();

            // 描边以填充缝隙
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        ctx.restore();

        // 绘制完成后，切换显示层
        // 使用 requestAnimationFrame 确保绘制已提交到 GPU
        requestAnimationFrame(() => {
            activeLayerLogicRef.current = targetLayer; // 更新逻辑层引用
            setActiveLayer(targetLayer); // 更新状态，触发渲染
        });

    }, [meshResult, zoneAnalysis, activeDimension, canvasSize]);


    // 3. 渲染轮廓线 (Contour Layer)
    useEffect(() => {
        if (!showContours || !meshResult || !contourRef.current) return;
        const ctx = contourRef.current.getContext("2d");
        if (!ctx) return;

        const { width, height } = canvasSize;
        if (width === 0 || height === 0) return;

        contourRef.current.width = width;
        contourRef.current.height = height;
        ctx.clearRect(0, 0, width, height);

        const landmarks = meshResult.landmarks;

        // 定义主要的五官轮廓连接
        // 使用 try-catch 保护，防止 MediaPipe 常量版本不匹配
        try {
            const contourConnections = [
                FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
                FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
                FaceLandmarker.FACE_LANDMARKS_LIPS,
                FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
                FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
                FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW
            ];

            ctx.save();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; // 半透明白色轮廓
            ctx.lineWidth = width * 0.002; // 根据宽度动态调整线宽
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            const landmarkCount = landmarks.length;

            contourConnections.forEach(connectionList => {
                if (!connectionList) return;

                ctx.beginPath();
                connectionList.forEach(({ start, end }) => {
                    // 越界保护
                    if (start >= landmarkCount || end >= landmarkCount) return;

                    const p1 = landmarks[start];
                    const p2 = landmarks[end];

                    ctx.moveTo(p1.x * width, p1.y * height);
                    ctx.lineTo(p2.x * width, p2.y * height);
                });
                ctx.stroke();
            });
            ctx.restore();

        } catch (e) {
            console.warn("[Overlay] Failed to draw contours:", e);
        }

    }, [showContours, meshResult, canvasSize]);

    // 4. 处理点击交互 (Interaction)
    const handleInteraction = (e: React.MouseEvent) => {
        if (!meshResult || !onZoneClick || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 归一化坐标
        const normX = x / rect.width;
        const normY = y / rect.height;

        // 寻找最近的顶点
        let minDist = Infinity;
        let nearestIndex = -1;

        // 优化：只搜索核心区域的顶点？或者全部搜索
        // 478 个点全部遍历非常快，无需优化
        meshResult.landmarks.forEach((lm, idx) => {
            const dx = lm.x - normX;
            const dy = lm.y - normY;
            // z 轴忽略
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                nearestIndex = idx;
            }
        });

        // 阈值判定：距离必须小于一定范围 (e.g. 5% 屏幕宽度)
        // normalized distance squared
        const threshold = 0.05 * 0.05;

        if (minDist < threshold && nearestIndex !== -1) {
            // 获取该顶点的区域
            const zone = getVertexZone(nearestIndex);
            if (zone) {
                // 震动反馈 (如果支持)
                if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate(50);
                }
                onZoneClick(zone);
            }
        }
    };

    return (
        <div
            ref={containerRef}
            className={cn("relative w-full h-full overflow-hidden select-none", className)}
            onClick={handleInteraction}
        >
            {/* 原始图片 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                ref={imgRef}
                src={imageUrl}
                alt="Analysis Target"
                crossOrigin="anonymous"
                className="block w-full h-full object-cover pointer-events-none"
            />

            {/* Layer 1: 热力图层 (双缓冲 Crossfade) */}
            <canvas
                ref={heatmapRef0}
                className="absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply blur-xl transition-opacity duration-700"
                style={{ opacity: (isLoaded && zoneAnalysis && activeLayer === 0) ? 0.7 : 0 }}
            />
            <canvas
                ref={heatmapRef1}
                className="absolute inset-0 w-full h-full pointer-events-none mix-blend-multiply blur-xl transition-opacity duration-700"
                style={{ opacity: (isLoaded && zoneAnalysis && activeLayer === 1) ? 0.7 : 0 }}
            />

            {/* Layer 2: 轮廓图层 (清晰线条) */}
            <canvas
                ref={contourRef}
                className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700"
                style={{ opacity: isLoaded && showContours ? 1 : 0 }}
            />

            {/* Loading 状态 */}
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/80" />
                        <span className="text-xs text-white/80 font-medium">AI 分析中...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
