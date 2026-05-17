"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { m } from "framer-motion";
import {
  RefreshCw,
  Sun,
  SunDim,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FaceScanOverlay } from "./FaceScanOverlay";

const DEBUG = process.env.NODE_ENV === 'development';

// 四张照片的数据结构
export interface FaceCaptureImages {
  front: string;
  left: string;
  right: string;
  chin: string;
}

interface FaceCaptureProps {
  onCapture: (images: FaceCaptureImages) => void;
  onModelsLoaded?: () => void;
  externalFaceApi?: any; // 外部预加载的 face-api 实例
}

type LightLevel = "excellent" | "good" | "low" | "too_dark" | "too_bright" | "uneven" | "unknown";
type FaceStatus = "none" | "detecting" | "found" | "ready";

// 拍照步骤类型
type CaptureStep = "front" | "left" | "right" | "chin";

// 头部朝向类型
type HeadPose = "front" | "left" | "right" | "chin" | "unknown";

// 步骤配置
const CAPTURE_STEPS: { step: CaptureStep; label: string; instruction: string; icon: React.ReactNode }[] = [
  { step: "front", label: "正脸", instruction: "请正对镜头", icon: <User className="h-6 w-6" /> },
  { step: "left", label: "左转", instruction: "请向左转头", icon: <ChevronLeft className="h-6 w-6" /> },
  { step: "right", label: "右转", instruction: "请向右转头", icon: <ChevronRight className="h-6 w-6" /> },
  { step: "chin", label: "下颚", instruction: "请微微抬头", icon: <ChevronUp className="h-6 w-6" /> },
];

/**
 * 面部拍照/上传组件
 * 功能：
 * - 摄像头调用 (WebRTC getUserMedia)
 * - 自动面部检测 (face-api.js)
 * - 检测到稳定面部后自动拍照
 * - 拍照功能 (Canvas 截图)
 * - 图片上传 (文件选择器)
 * - 面部框引导 (椭圆形引导框)
 * - 光线检测提示
 * - 前置/后置摄像头切换
 */
export function FaceCapture({ onCapture, onModelsLoaded, externalFaceApi }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceDetectionRef = useRef<number | null>(null);
  const stableCountRef = useRef<number>(0);
  const cooldownRef = useRef<boolean>(false); // 步骤切换冷却标志
  const lastSpeakTimeRef = useRef<number>(0); // 语音防抖时间戳
  const lastSpokenPhraseRef = useRef<string>(""); // 避免短时间内重复播报同一句话
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null); // 冷却进度定时器

  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<Record<CaptureStep, string | null>>({
    front: null,
    left: null,
    right: null,
    chin: null,
  });
  const [currentStep, setCurrentStep] = useState<CaptureStep>("front");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [lightLevel, setLightLevel] = useState<LightLevel>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [stabilityProgress, setStabilityProgress] = useState<number>(0); // 姿势稳定进度 0-100
  const [isInCooldown, setIsInCooldown] = useState<boolean>(false); // 冷却状态 UI 显示
  const [cooldownProgress, setCooldownProgress] = useState<number>(0); // 冷却进度 0-100
  const [isMuted, setIsMuted] = useState(false); // 静音状态
  const [isLoading, setIsLoading] = useState(true);
  const [faceStatus, setFaceStatus] = useState<FaceStatus>("none");
  const [showManualButton, setShowManualButton] = useState(false); // 是否显示手动拍照按钮
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [isAllCaptured, setIsAllCaptured] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [modelLoadFailed, setModelLoadFailed] = useState(false); // 模型加载失败状态
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceApiRef = useRef<any>(null);
  // 保存最新的面部检测框，用于裁剪
  const faceBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  // 摄像头初始化调用ID，防竞态
  const initCallIdRef = useRef(0);
  // 面部检测并发锁
  const isDetectingRef = useRef(false);
  // 语音锁定截止时间
  const speakLockUntilRef = useRef<number>(0);
  // 当前步骤开始时间，用于手动按钮计时
  const stepStartTimeRef = useRef<number>(0);
  // 标记刚完成拍照的时间戳，用于语音时序对齐
  const justCapturedRef = useRef<number | null>(null);
  // 调试信息
  const [debugInfo, setDebugInfo] = useState<{
    headPose: string;
    noseOffsetRatio: number;
    tiltRatio: number;
    isInEllipse: boolean;
    isSizeOk: boolean;
    faceToEllipseRatio: number;
    isPoseCorrect: boolean;
    currentStep: string;
    displayBox: { x: number; y: number; width: number; height: number } | null;
  } | null>(null);

  /**
   * 初始化摄像头
   * 注意：禁用美颜效果，确保获取原始相机画面用于AI肌肤分析
   */
  const initCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const callId = ++initCallIdRef.current;

    try {
      // 先停止现有流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      let mediaStream: MediaStream;

      // 尝试多组分辨率，从优到劣
      const constraintsList = [
        { video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, min: 15 } } },
        { video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 15 } } },
        { video: { facingMode, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30, min: 15 } } },
      ];

      let lastError: Error | null = null;
      for (const constraints of constraintsList) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          lastError = null;
          break;
        } catch (e) {
          lastError = e as Error;
          if ((e as Error)?.name !== 'OverconstrainedError') throw e;
          // 继续尝试更低分辨率
        }
      }

      if (lastError) throw lastError;

      // 竞态保护：如果 facingMode 在此期间已变化，丢弃本次结果
      if (callId !== initCallIdRef.current) {
        mediaStream!.getTracks().forEach(t => t.stop());
        return;
      }

      console.log("Camera stream obtained:", mediaStream!.id, mediaStream!.getVideoTracks()[0].label);

      // Try to apply advanced constraints after stream is obtained
      try {
        const videoTrack = mediaStream!.getVideoTracks()[0];
        if (videoTrack) {
          await videoTrack.applyConstraints({
            advanced: [
              { beautificationMode: "off" } as any,
              { imageEnhancement: false } as any
            ]
          });
        }
      } catch (e) {
        console.warn("Could not apply beautification constraints:", e);
      }

      streamRef.current = mediaStream!;
      setStream(mediaStream!);
      setIsLoading(false);
    } catch (err) {
      // 竞态保护：忽略过期的错误
      if (callId !== initCallIdRef.current) return;

      console.error("Camera error:", err);

      if ((err as Error)?.name === 'AbortError') {
        console.warn("Camera init interrupted, ignoring.");
        return;
      }

      let errorMessage = "无法访问摄像头，请检查权限设置";
      const errorName = (err as Error)?.name;

      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        errorMessage = "摄像头权限被拒绝，请在浏览器地址栏点击锁图标允许访问摄像头";
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        errorMessage = "未检测到摄像头设备，请检查设备连接";
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        errorMessage = "摄像头可能被其他应用占用（如微信/Zoom），请关闭后重试";
      } else if (errorName === 'OverconstrainedError') {
        errorMessage = "摄像头不支持请求的分辨率，请更换设备重试";
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  }, [facingMode]);

  /**
   * 加载 face-api.js 和模型
   * 支持外部预加载：如果父组件已经加载了模型，直接使用外部实例
   */
  const loadFaceApi = useCallback(async () => {
    if (faceApiLoaded) return;

    // 如果外部已经预加载了 face-api 实例，直接复用
    if (externalFaceApi) {
      faceApiRef.current = externalFaceApi;
      setModelsLoaded(true);
      setFaceApiLoaded(true);
      setModelLoadFailed(false);
      console.log("Face detection models reused from preload");
      onModelsLoaded?.();
      return;
    }

    try {
      // 动态导入 @vladmandic/face-api
      const faceapi = await import("@vladmandic/face-api");
      faceApiRef.current = faceapi;

      // 从本地加载 TinyFaceDetector 和 faceLandmark68Net 模型，15秒超时
      await Promise.race([
        Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("模型加载超时")), 15000))
      ]);

      setModelsLoaded(true);
      setFaceApiLoaded(true);
      setModelLoadFailed(false);
      console.log("Face detection models loaded (including landmarks)");
      onModelsLoaded?.();
    } catch (err) {
      console.error("Failed to load face detection:", err);
      setModelsLoaded(false);
      setModelLoadFailed(true);
    }
  }, [faceApiLoaded, externalFaceApi, onModelsLoaded]);

  /**
   * 根据面部关键点计算头部朝向
   * 使用鼻尖和眼睛位置来判断头部方向
   * 包含左右转头和仰头（下颚）检测
   */
  const calculateHeadPose = useCallback((landmarks: { positions: { x: number; y: number }[] }, targetStep: CaptureStep): HeadPose => {
    const positions = landmarks.positions;

    // 68点面部关键点索引
    // 左眼外角: 36, 右眼外角: 45
    // 鼻尖: 30
    // 面部左右边缘: 0, 16
    // 下巴: 8, 眉心: 27

    const leftEyeOuter = positions[36];
    const rightEyeOuter = positions[45];
    const noseTip = positions[30];
    const faceLeft = positions[0];
    const faceRight = positions[16];
    const chin = positions[8];
    const _noseBridge = positions[27];

    // 计算眼睛中心
    const eyesCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2;
    const eyesCenterY = (leftEyeOuter.y + rightEyeOuter.y) / 2;

    // 计算面部宽度
    const faceWidth = faceRight.x - faceLeft.x;

    // 计算鼻尖水平偏移比例 (Mirror mode: Left turn -> nose right -> ratio > 0)
    const noseOffsetRatio = (noseTip.x - eyesCenterX) / faceWidth;

    // 计算仰头指标：鼻尖到眼连线垂距 / 眼到下巴垂距
    const noseToEyesY = noseTip.y - eyesCenterY;
    const eyesToChinY = chin.y - eyesCenterY;
    // 避免除以零
    const tiltRatio = eyesToChinY !== 0 ? noseToEyesY / eyesToChinY : 0.5;

    // --- 判定逻辑 ---

    // 基础标志位
    // 大幅放宽阈值，用户体验优先，能拍到即可，不追求精确对准
    const isLookingLeft = noseOffsetRatio > 0.06;
    const isLookingRight = noseOffsetRatio < -0.06;
    const isLookingCenter = Math.abs(noseOffsetRatio) < 0.45;

    // 抬头标志: tiltRatio 越小越仰头
    // 大幅放宽到 0.50，几乎只要抬头就能过
    const isLookingUp = tiltRatio < 0.50;

    // 优先匹配当前目标步骤 (Bias towards user intent)

    if (targetStep === 'left') {
      // 只要往左转了，哪怕有点抬头/低头也通过
      if (isLookingLeft) return "left";
    }

    if (targetStep === 'right') {
      // 只要往右转了，哪怕有点抬头/低头也通过
      if (isLookingRight) return "right";
    }

    if (targetStep === 'chin') {
      // 抬头检测：tiltRatio 越小表示仰头越明显
      // 注意：不同人面部比例差异大（鼻子长短、下巴长短），正常平视的 tiltRatio
      // 可能在 0.25~0.55 之间波动。阈值设得太低（如 0.30）会导致很多用户正常
      // 平视时被误判为抬头。收紧到 0.15 确保只有真正明显的抬头动作才会触发。
      if (tiltRatio < 0.15 && Math.abs(noseOffsetRatio) < 0.55) {
        return "chin";
      }
    }

    if (targetStep === 'front') {
      // 只要水平居中，允许自然的低头/抬头
      if (isLookingCenter) return "front";
    }

    // Fallback: 如果不符合主要目标，返回检测到的姿态
    // 注意：移除了 isLookingUp 的 Fallback，防止自然姿态被误判为抬头
    // 抬头检测只在 targetStep === 'chin' 时才生效
    if (isLookingLeft) return "left";
    if (isLookingRight) return "right";
    if (isLookingCenter) return "front";

    return "unknown";
  }, []);

  /**
   * 把视频原始坐标框映射到 CSS 显示坐标系（处理 object-fit: cover 的缩放/裁剪）
   * 前置摄像头时额外处理 CSS scale-x-[-1] 镜像，确保 overlay 对齐
   */
  const mapVideoBoxToDisplay = useCallback((
    videoBox: { x: number; y: number; width: number; height: number },
    videoWidth: number,
    videoHeight: number,
    displayWidth: number,
    displayHeight: number,
    facingMode: "user" | "environment"
  ) => {
    const scale = Math.max(displayWidth / videoWidth, displayHeight / videoHeight);
    const scaledVideoWidth = videoWidth * scale;
    const scaledVideoHeight = videoHeight * scale;
    const offsetX = (displayWidth - scaledVideoWidth) / 2;
    const offsetY = (displayHeight - scaledVideoHeight) / 2;

    let x = videoBox.x * scale + offsetX;
    const y = videoBox.y * scale + offsetY;
    const width = videoBox.width * scale;
    const height = videoBox.height * scale;

    // 前置摄像头视频被 CSS scale-x-[-1] 镜像，x 坐标需要翻转
    if (facingMode === "user") {
      x = displayWidth - x - width;
    }

    return { x, y, width, height };
  }, []);

  /**
   * 检查面部是否在椭圆框内（使用显示坐标系，与 FaceScanOverlay UI 严格对齐）
   * 椭圆框尺寸：宽度65%，高度70%
   *
   * 判断策略：以中心点为主（只要脸中心在椭圆内就算在），四个角点为辅助，
   * 大幅放宽容错，避免视觉明明在框内但逻辑判定失败的情况。
   */
  const isFaceInEllipse = useCallback((
    faceBox: { x: number; y: number; width: number; height: number },
    containerWidth: number,
    containerHeight: number
  ): boolean => {
    // 椭圆参数（与 FaceScanOverlay 一致）
    const ellipseWidthRatio = 0.65;
    const ellipseHeightRatio = 0.70;

    // 椭圆中心（容器中心）
    const ellipseCenterX = containerWidth / 2;
    const ellipseCenterY = containerHeight / 2;

    // 椭圆半轴
    const ellipseA = (containerWidth * ellipseWidthRatio) / 2;  // 水平半轴
    const ellipseB = (containerHeight * ellipseHeightRatio) / 2; // 垂直半轴

    // 1. 检查面部中心点是否在椭圆内（核心判断）
    const centerX = faceBox.x + faceBox.width / 2;
    const centerY = faceBox.y + faceBox.height / 2;
    const normCenterX = (centerX - ellipseCenterX) / ellipseA;
    const normCenterY = (centerY - ellipseCenterY) / ellipseB;
    const centerValue = normCenterX * normCenterX + normCenterY * normCenterY;

    // 2. 检查四个角点，统计在椭圆内的数量（放宽到 1.3 容错）
    const faceCorners = [
      { x: faceBox.x, y: faceBox.y },
      { x: faceBox.x + faceBox.width, y: faceBox.y },
      { x: faceBox.x, y: faceBox.y + faceBox.height },
      { x: faceBox.x + faceBox.width, y: faceBox.y + faceBox.height },
    ];

    let cornersInside = 0;
    for (const corner of faceCorners) {
      const nx = (corner.x - ellipseCenterX) / ellipseA;
      const ny = (corner.y - ellipseCenterY) / ellipseB;
      if (nx * nx + ny * ny <= 1.3) {
        cornersInside++;
      }
    }

    // 策略：中心点必须在椭圆内，且至少 2 个角点在椭圆内（允许部分头发/耳朵超出）
    return centerValue <= 1.0 && cornersInside >= 2;
  }, []);

  /* 语音播报函数 */
  const speak = useCallback((text: string) => {
    if (isMuted || typeof window === 'undefined') return;
    try {
      // 防止同一个指令在短时间内重复堆积
      if (window.speechSynthesis.speaking && text === lastSpokenPhraseRef.current) {
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 1.0;
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis failed", e);
    }
  }, [isMuted]);

  /**
   * 检测面部和头部朝向
   */
  const detectFace = useCallback(async () => {
    if (cooldownRef.current || isDetectingRef.current) return;
    if (!videoRef.current || !faceApiRef.current || !modelsLoaded || isAllCaptured) return;

    const video = videoRef.current;
    if (video.readyState < 2) return;

    isDetectingRef.current = true;

    try {
      const faceapi = faceApiRef.current;
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
        .withFaceLandmarks();

      if (detection) {
        const { box } = detection.detection;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const displayWidth = video.clientWidth;
        const displayHeight = video.clientHeight;

        // 保存面部检测框用于裁剪（保持原始视频坐标）
        faceBoxRef.current = { x: box.x, y: box.y, width: box.width, height: box.height };

        // 映射到显示坐标系（解决 object-cover 裁剪导致的坐标错位）
        const displayBox = mapVideoBoxToDisplay(
          { x: box.x, y: box.y, width: box.width, height: box.height },
          videoWidth,
          videoHeight,
          displayWidth,
          displayHeight,
          facingMode
        );

        // 检查面部是否在椭圆框内（仅作为视觉引导，不作为硬性拍照门槛）
        const isInEllipse = isFaceInEllipse(displayBox, displayWidth, displayHeight);

        // 检查面部大小是否合适——大幅放宽，能拍到就行
        const ellipseHeight = videoHeight * 0.70;
        const faceToEllipseRatio = box.height / ellipseHeight;
        const isSizeOk = faceToEllipseRatio > 0.15 && faceToEllipseRatio < 1.05;

        // 计算头部朝向 (传入 currentStep 以优化判定逻辑)
        const headPose = calculateHeadPose(detection.landmarks, currentStep);

        // 检查当前头部朝向是否匹配当前步骤
        const isPoseCorrect = headPose === currentStep;

        // 调试信息
        if (DEBUG) {
          const positions = detection.landmarks.positions;
          const leftEyeOuter = positions[36];
          const rightEyeOuter = positions[45];
          const noseTip = positions[30];
          const faceLeft = positions[0];
          const faceRight = positions[16];
          const chin = positions[8];
          const eyesCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2;
          const eyesCenterY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
          const faceWidth = faceRight.x - faceLeft.x;
          const noseOffsetRatio = (noseTip.x - eyesCenterX) / faceWidth;
          const noseToEyesY = noseTip.y - eyesCenterY;
          const eyesToChinY = chin.y - eyesCenterY;
          const tiltRatio = eyesToChinY !== 0 ? noseToEyesY / eyesToChinY : 0.5;
          setDebugInfo({
            headPose,
            noseOffsetRatio: Math.round(noseOffsetRatio * 1000) / 1000,
            tiltRatio: Math.round(tiltRatio * 1000) / 1000,
            isInEllipse,
            isSizeOk,
            faceToEllipseRatio: Math.round(faceToEllipseRatio * 100) / 100,
            isPoseCorrect,
            currentStep,
            displayBox,
          });
        }

        // 核心拍照条件：姿势正确 + 大小基本合适（椭圆框只是视觉引导，不硬性限制）
        const canCapture = isSizeOk && isPoseCorrect;

        if (canCapture) {
          stableCountRef.current += 1;
          setFaceStatus("found");

          // 大幅放宽稳定帧数要求，2帧即可拍照，体验更流畅
          // 但下颚（抬头）步骤容易误判，需要更多稳定帧
          const requiredFrames = currentStep === 'chin' ? 5 : 2;
          const progressFrames = currentStep === 'chin' ? 6 : 3;

          // 更新稳定进度
          setStabilityProgress(Math.min(100, (stableCountRef.current / progressFrames) * 100));

          // 达到稳定帧数立即拍照，先打断当前语音避免滞后播报
          if (stableCountRef.current >= requiredFrames) {
            setFaceStatus("ready");
            setStabilityProgress(100);

            const now = Date.now();
            lastSpeakTimeRef.current = now;
            speakLockUntilRef.current = now + 1500;

            // 拍照前打断所有语音，避免拍完还在播旧指令
            if (typeof window !== 'undefined' && window.speechSynthesis) {
              window.speechSynthesis.cancel();
            }

            // 立即重置稳定计数，防止 setTimeout 异步窗口期内重复触发拍照
            stableCountRef.current = 0;

            takePhotoAuto();
          } else if (stableCountRef.current === 1) {
            const now = Date.now();
            if (now > speakLockUntilRef.current && now - lastSpeakTimeRef.current > 2000 && lastSpokenPhraseRef.current !== "保持") {
              speak("请保持");
              lastSpeakTimeRef.current = now;
              lastSpokenPhraseRef.current = "保持";
            }
          }
        } else {
          // 轻微衰减，流程更宽容
          stableCountRef.current = Math.max(0, stableCountRef.current - 1);
          setStabilityProgress(Math.min(100, (stableCountRef.current / 3) * 100));
          setFaceStatus("detecting");

          const now = Date.now();
          if (now > speakLockUntilRef.current && now - lastSpeakTimeRef.current > 6000 && !isPoseCorrect) {
            let feedback = "";
            if (currentStep === "left") {
              feedback = "请向左边转头";
            } else if (currentStep === "right") {
              feedback = "请向右边转头";
            } else if (currentStep === "chin") {
              feedback = "请稍微抬头";
            } else if (currentStep === "front") {
              feedback = "请正对镜头";
            }

            if (feedback && feedback !== lastSpokenPhraseRef.current) {
              speak(feedback);
              lastSpeakTimeRef.current = now;
              lastSpokenPhraseRef.current = feedback;
            }
          }
        }
      } else {
        stableCountRef.current = 0;
        faceBoxRef.current = null;

        setFaceStatus("detecting");
      }
    } catch (err) {
      console.error("Face detection error:", err);
    } finally {
      isDetectingRef.current = false;
    }
  }, [modelsLoaded, isAllCaptured, calculateHeadPose, currentStep, isFaceInEllipse, mapVideoBoxToDisplay, speak, facingMode]);

  // 监听步骤变化并播报语音指令
  useEffect(() => {
    if (isAllCaptured || isLoading) return;

    const instruction = CAPTURE_STEPS.find(s => s.step === currentStep)?.instruction;
    if (instruction) {
      // 如果刚拍完照（2秒内），延迟更久让"好"先播完，避免打断
      const timeSinceCapture = justCapturedRef.current ? Date.now() - justCapturedRef.current : Infinity;
      const delay = timeSinceCapture < 2000 ? 800 : 500;

      const timer = setTimeout(() => {
        // 时间到了再 cancel，避免打断"好"
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        speak(instruction);
        lastSpeakTimeRef.current = Date.now();
        lastSpokenPhraseRef.current = instruction;
        justCapturedRef.current = null; // 清除标记
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [currentStep, isAllCaptured, isLoading, speak]);

  /**
   * 获取下一步骤
   */
  const getNextStep = useCallback((current: CaptureStep): CaptureStep | null => {
    const stepOrder: CaptureStep[] = ["front", "left", "right", "chin"];
    const currentIndex = stepOrder.indexOf(current);
    if (currentIndex < stepOrder.length - 1) {
      return stepOrder[currentIndex + 1];
    }
    return null;
  }, []);

  /**
   * 自动拍照并进入下一步
   * 优化：根据面部检测框裁剪图像，去除多余背景
   */
  const takePhotoAuto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || cooldownRef.current) return;

    setTimeout(() => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

    let imageData: string;

    // 如果有面部检测框，进行智能裁剪
    if (faceBoxRef.current) {
      const faceBox = faceBoxRef.current;

      // 扩展裁剪区域：上方多留40%（头发），下方多留30%（脖子），左右各多留35%
      const expandTop = faceBox.height * 0.5;
      const expandBottom = faceBox.height * 0.35;
      const expandSide = faceBox.width * 0.4;

      // 计算裁剪区域
      let cropX = faceBox.x - expandSide;
      let cropY = faceBox.y - expandTop;
      let cropWidth = faceBox.width + expandSide * 2;
      let cropHeight = faceBox.height + expandTop + expandBottom;

      // 确保不超出视频边界
      cropX = Math.max(0, cropX);
      cropY = Math.max(0, cropY);
      cropWidth = Math.min(cropWidth, videoWidth - cropX);
      cropHeight = Math.min(cropHeight, videoHeight - cropY);

      // 保持宽高比为 3:4（适合人像）
      const targetRatio = 3 / 4;
      const currentRatio = cropWidth / cropHeight;

      if (currentRatio > targetRatio) {
        // 太宽了，增加高度或减少宽度
        const newWidth = cropHeight * targetRatio;
        cropX += (cropWidth - newWidth) / 2;
        cropWidth = newWidth;
      } else {
        // 太高了，增加宽度或减少高度
        const newHeight = cropWidth / targetRatio;
        cropY += (cropHeight - newHeight) / 2;
        cropHeight = newHeight;
      }

      // 再次确保边界
      cropX = Math.max(0, Math.min(cropX, videoWidth - cropWidth));
      cropY = Math.max(0, Math.min(cropY, videoHeight - cropHeight));

      // 设置输出尺寸（保持高质量）
      const outputWidth = 720;
      const outputHeight = 960;
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      // 前置摄像头需要镜像处理
      if (facingMode === "user") {
        ctx.translate(outputWidth, 0);
        ctx.scale(-1, 1);
        // 镜像时需要调整 cropX
        const mirroredCropX = videoWidth - cropX - cropWidth;
        ctx.drawImage(video, mirroredCropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
      } else {
        ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
      }

      // Encode with standard quality to reduce base64 size for the API
      imageData = canvas.toDataURL("image/jpeg", 0.75);
    } else {
      // 没有面部检测框，使用原始方式
      canvas.width = videoWidth;
      canvas.height = videoHeight;

      if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0);
      imageData = canvas.toDataURL("image/jpeg", 0.75);
    }

    // 保存当前步骤的照片
    setCapturedImages(prev => ({
      ...prev,
      [currentStep]: imageData,
    }));

    // 播报拍照成功反馈，先清空队列避免旧指令滞后
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speak("好");
    justCapturedRef.current = Date.now(); // 标记刚拍完，用于下一步语音延迟对齐

    stableCountRef.current = 0;
    faceBoxRef.current = null; // 重置面部框

    // 检查是否还有下一步
    const nextStep = getNextStep(currentStep);

    if (nextStep) {
      // **关键修复：启用冷却期，防止连续拍照**
      cooldownRef.current = true;
      setIsInCooldown(true);
      setFaceStatus("none");
      setStabilityProgress(0);
      setCooldownProgress(0);

      // 进入下一步
      setCurrentStep(nextStep);

      // 冷却期：下颚步骤给用户更多准备时间，防止还没反应过来就拍完
      // 注意：这里用 nextStep 判断，因为 currentStep 还没更新
      const cooldownDuration = nextStep === 'chin' ? 2000 : 800;
      const progressInterval = 50; // 每 50ms 更新一次进度
      let elapsed = 0;

      // Clear any existing timer first
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      progressTimerRef.current = setInterval(() => {
        elapsed += progressInterval;
        const progress = Math.min(100, (elapsed / cooldownDuration) * 100);
        setCooldownProgress(progress);

        if (elapsed >= cooldownDuration) {
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }
          cooldownRef.current = false;
          setIsInCooldown(false);
          setCooldownProgress(0);
        }
      }, progressInterval);

    } else {
      // 所有步骤完成 - 直接调用 onCapture 并传递所有照片
      setIsAllCaptured(true);

      // 停止面部检测
      if (faceDetectionRef.current) {
        cancelAnimationFrame(faceDetectionRef.current);
        faceDetectionRef.current = null;
      }

      // 停止摄像头
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);

      // 直接调用 onCapture，传递所有四张照片
      const allImages: FaceCaptureImages = {
        front: currentStep === "front" ? imageData : capturedImages.front!,
        left: currentStep === "left" ? imageData : capturedImages.left!,
        right: currentStep === "right" ? imageData : capturedImages.right!,
        chin: imageData, // 最后一步一定是 chin
      };
      onCapture(allImages);
    }
    }, 0);
  }, [facingMode, currentStep, getNextStep, stream, capturedImages, onCapture, speak]);

  /**
   * 分析光线条件 - 增强版
   * 检测：亮度、对比度、均匀度
   */
  const analyzeLightLevel = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = 100; // 小尺寸用于快速分析
    canvas.height = 75;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 100, 75);

    const imageData = ctx.getImageData(0, 0, 100, 75);
    const data = imageData.data;
    const pixelCount = data.length / 4;

    // 计算亮度统计
    let totalBrightness = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    const brightnessValues: number[] = [];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // 使用感知亮度公式
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
      brightnessValues.push(brightness);
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
    }

    const avgBrightness = totalBrightness / pixelCount;

    // 计算标准差（光线均匀度）
    let variance = 0;
    for (const b of brightnessValues) {
      variance += Math.pow(b - avgBrightness, 2);
    }
    const stdDev = Math.sqrt(variance / pixelCount);

    // 计算动态范围（对比度）
    const dynamicRange = maxBrightness - minBrightness;

    // 综合评分计算
    let score = 0;
    let level: LightLevel = "unknown";

    // 亮度评分 (0-40分) - 理想范围 100-180
    if (avgBrightness >= 100 && avgBrightness <= 180) {
      score += 40;
    } else if (avgBrightness >= 80 && avgBrightness <= 200) {
      score += 30;
    } else if (avgBrightness >= 50 && avgBrightness <= 220) {
      score += 15;
    }

    // 均匀度评分 (0-30分) - 标准差越小越好，理想 < 40
    if (stdDev < 30) {
      score += 30;
    } else if (stdDev < 50) {
      score += 20;
    } else if (stdDev < 70) {
      score += 10;
    }

    // 对比度评分 (0-30分) - 动态范围适中 60-150
    if (dynamicRange >= 60 && dynamicRange <= 150) {
      score += 30;
    } else if (dynamicRange >= 40 && dynamicRange <= 180) {
      score += 20;
    } else if (dynamicRange >= 20) {
      score += 10;
    }


    // 根据评分和具体问题设置状态
    if (score >= 85) {
      level = "excellent";
    } else if (score >= 65) {
      level = "good";
    } else if (avgBrightness > 220) {
      level = "too_bright";
    } else if (avgBrightness < 50) {
      level = "too_dark";
    } else if (stdDev > 60) {
      level = "uneven";
    } else {
      level = "low";
    }

    setLightLevel(level);
  }, []);

  /**
   * 切换前后摄像头
   */
  const toggleCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  // 加载 face-api.js
  useEffect(() => {
    loadFaceApi();
  }, [loadFaceApi]);

  // 检测是否有多个摄像头
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setHasMultipleCameras(videoInputs.length > 1);
    }).catch(() => {
      setHasMultipleCameras(false);
    });
  }, []);

  // Separate Effect to bind stream to video element
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        console.warn("Video play error (handled):", e);
      });
    }
  }, [stream]);

  // 初始化摄像头
  useEffect(() => {
    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [facingMode, initCamera]);

  // 面部检测循环
  useEffect(() => {
    if (!stream || !modelsLoaded || isAllCaptured || isLoading) return;

    let animationId: number;
    let lastDetectionTime = 0;
    const detectionInterval = 50; // 检测间隔 50ms ≈ 20 FPS，大幅提升动作跟踪灵敏度

    const runDetection = (timestamp: number) => {
      if (timestamp - lastDetectionTime >= detectionInterval) {
        detectFace();
        lastDetectionTime = timestamp;
      }
      animationId = requestAnimationFrame(runDetection);
    };

    animationId = requestAnimationFrame(runDetection);
    faceDetectionRef.current = animationId;

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [stream, modelsLoaded, isAllCaptured, isLoading, detectFace]);

  // 定时检测光线
  useEffect(() => {
    if (!stream || isAllCaptured) return;

    const interval = setInterval(analyzeLightLevel, 1000);
    return () => clearInterval(interval);
  }, [stream, isAllCaptured, analyzeLightLevel]);

  // 步骤切换时重置手动按钮计时
  useEffect(() => {
    stepStartTimeRef.current = Date.now();
    setShowManualButton(false);
  }, [currentStep]);

  // 5秒后显示手动拍照按钮
  useEffect(() => {
    if (isAllCaptured || isLoading || error || isInCooldown) {
      setShowManualButton(false);
      return;
    }

    const remaining = Math.max(0, 5000 - (Date.now() - stepStartTimeRef.current));
    const timer = setTimeout(() => {
      setShowManualButton(true);
    }, remaining);

    return () => clearTimeout(timer);
  }, [isAllCaptured, isLoading, error, isInCooldown, currentStep]);

  /**
   * 渲染光线提示 - 精简版
   * 只显示图标+状态文字，去掉分数和建议
   */
  const renderLightIndicator = () => {
    const configs: Record<LightLevel, { icon: typeof Sun; text: string; className: string }> = {
      excellent: {
        icon: Sun,
        text: "光线极佳",
        className: "text-green-600",
      },
      good: {
        icon: Sun,
        text: "光线良好",
        className: "text-green-600",
      },
      low: {
        icon: SunDim,
        text: "光线偏暗",
        className: "text-yellow-600",
      },
      too_dark: {
        icon: SunDim,
        text: "光线太暗",
        className: "text-orange-600",
      },
      too_bright: {
        icon: Sun,
        text: "光线过强",
        className: "text-orange-600",
      },
      uneven: {
        icon: SunDim,
        text: "光线不均",
        className: "text-yellow-600",
      },
      unknown: {
        icon: Sun,
        text: "检测中...",
        className: "text-gray-400",
      },
    };

    const config = configs[lightLevel];
    const Icon = config.icon;

    return (
      <div className={cn("inline-flex items-center gap-1.5 text-xs", config.className)}>
        <Icon className="h-3.5 w-3.5" />
        <span>{config.text}</span>
      </div>
    );
  };

  // 获取当前步骤配置

  // 获取当前步骤配置
  const currentStepConfig = CAPTURE_STEPS.find(s => s.step === currentStep);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* 隐藏的 Canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ⚠️ 沉浸式全屏视频流 */}
      <div className="absolute inset-0 z-0">
        {!isAllCaptured ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "h-full w-full object-cover",
              facingMode === "user" && "scale-x-[-1]"
            )}
          />
        ) : (
          /* 拍摄完成后显示模糊的最后一张图作为背景 */
          <div className="relative h-full w-full">
            <m.img
              src={capturedImages.front || capturedImages.chin || ""}
              className="h-full w-full object-cover blur-2xl opacity-50 scale-110"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <div className="h-16 w-16 mb-6 rounded-full border-4 border-white/20 border-t-white animate-spin" />
              <p className="text-xl font-medium text-white tracking-widest">正在分析</p>
            </div>
          </div>
        )}

        {/* 视频遮罩：让文字更清晰，同时增加质感 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />

        {/* 调试信息面板 */}
        {DEBUG && debugInfo && (
          <div className="absolute top-20 left-4 z-50 bg-black/70 backdrop-blur-sm text-white text-[10px] font-mono p-3 rounded-lg border border-white/20 space-y-1 max-w-[220px]">
            <div className="text-brand-gold font-bold mb-1">DEBUG</div>
            <div>步骤: {debugInfo.currentStep}</div>
            <div>姿态: {debugInfo.headPose} {debugInfo.isPoseCorrect ? '✅' : '❌'}</div>
            <div>椭圆内: {debugInfo.isInEllipse ? '✅' : '❌'}</div>
            <div>大小: {debugInfo.isSizeOk ? '✅' : '❌'} ({debugInfo.faceToEllipseRatio})</div>
            <div>noseRatio: {debugInfo.noseOffsetRatio}</div>
            <div>tiltRatio: {debugInfo.tiltRatio}</div>
            {debugInfo.displayBox && (
              <div className="text-white/70">
                box: {Math.round(debugInfo.displayBox.x)},{Math.round(debugInfo.displayBox.y)} {Math.round(debugInfo.displayBox.width)}x{Math.round(debugInfo.displayBox.height)}
              </div>
            )}
          </div>
        )}

        {/* 检测框可视化 */}
        {DEBUG && debugInfo?.displayBox && (
          <div
            className="absolute border-2 border-red-500/70 z-40 pointer-events-none"
            style={{
              left: debugInfo.displayBox.x,
              top: debugInfo.displayBox.y,
              width: debugInfo.displayBox.width,
              height: debugInfo.displayBox.height,
            }}
          />
        )}
      </div>

      {/* ✨ 顶部步骤指示器 - 悬浮 */}
      {!isAllCaptured && (
        <div className="absolute top-6 left-0 right-0 z-20 flex justify-center pt-2">
          <div className="flex items-center gap-4">
            {CAPTURE_STEPS.map((step, index) => {
              const isCompleted = capturedImages[step.step] !== null;
              const isCurrent = step.step === currentStep;

              return (
                <div key={step.step} className="flex items-center">
                  <div className={cn(
                    "flex items-center gap-1.5 transition-all duration-300",
                    isCurrent ? "opacity-100" : "opacity-40"
                  )}>
                    {isCompleted ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                    ) : (
                      <div className={cn("h-1.5 w-1.5 rounded-full transition-all", isCurrent ? "bg-white scale-125" : "bg-white")} />
                    )}
                    <span className="text-[10px] font-medium tracking-widest uppercase text-white shadow-black drop-shadow-sm">
                      {step.label}
                    </span>
                  </div>
                  {/* Remove separator line for cleaner look */}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ✨ 中央取景框 overlay - 仅作为参考线 */}
      {!isAllCaptured && !isLoading && !error && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <FaceScanOverlay
            currentStep={currentStep}
            faceStatus={faceStatus}
            stabilityProgress={stabilityProgress}
          />
        </div>
      )}

      {/* ✨ 底部状态栏 - 悬浮 */}
      {!isAllCaptured && !isLoading && !error && (
        <div className="absolute bottom-8 left-0 right-0 z-20 flex flex-col items-center pointer-events-none px-4">

          {/* 状态提示文字 - 极大号，像电影字幕 */}
          <m.div
            key={currentStep} // 切换步骤时触发动画
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-4"
          >
            <h3 className="text-2xl md:text-3xl font-serif text-white mb-2 drop-shadow-md">
              {isInCooldown ? "请保持..." : currentStepConfig?.instruction}
            </h3>

            {/* 辅助状态：光线 和 自动拍照提示 */}
            <div className="flex items-center justify-center gap-4 text-white/60 text-sm font-light">
              {/* 光线指示 */}
              <div className="flex items-center gap-1.5">
                {lightLevel === 'low' || lightLevel === 'too_dark' ? (
                  <>
                    <SunDim className="w-4 h-4 text-yellow-300" />
                    <span className="text-yellow-100">光线不足</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4" />
                    <span>光线良好</span>
                  </>
                )}
              </div>
              {/* 拍照模式指示 */}
              <div className="flex items-center gap-1.5 border-l border-white/20 pl-4">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  faceStatus === 'ready' ? "bg-green-400 animate-pulse" : "bg-white/40"
                )} />
                <span>自动拍摄</span>
              </div>
            </div>
          </m.div>

          {/* 手动拍照按钮 (Fallback) */}
          {(showManualButton || modelLoadFailed) && (
            <div className="pointer-events-auto mt-4">
              <button
                onClick={takePhotoAuto}
                className="px-6 py-2 rounded-full border border-white/30 text-white text-sm hover:bg-white/10 transition-colors backdrop-blur-sm"
              >
                {modelLoadFailed ? "面部检测不可用，点击手动拍照" : "无法自动识别？点击手动拍照"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="mt-4 text-white/50 text-sm tracking-widest uppercase">正在启动摄像头</p>
        </div>
      )}

      {/* 模型加载失败提示 */}
      {modelLoadFailed && !isLoading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-8 text-center">
          <AlertCircle className="h-10 w-10 text-yellow-400 mb-3" />
          <p className="text-white/80 text-sm mb-2">面部检测加载失败</p>
          <p className="text-white/50 text-xs">您可以点击下方按钮手动拍照</p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-white text-lg font-medium mb-2">摄像头访问失败</h3>
          <p className="text-white/60 max-w-md mb-8">{error}</p>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.href = '/questions'}
              className="px-8 py-3 bg-white/10 border border-white/20 text-white rounded-full text-sm font-medium hover:bg-white/20 backdrop-blur-sm transition-colors"
            >
              返回上一页
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-white text-black rounded-full text-sm font-medium hover:bg-gray-200 shadow-xl transition-colors"
            >
              刷新重试
            </button>
          </div>
        </div>
      )}

      {/* 摄像头切换 - 右上角 */}
      {!isAllCaptured && !isLoading && (
        <div className="absolute top-8 right-8 z-30 flex gap-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-3 rounded-full bg-black/20 border border-white/10 text-white hover:bg-black/40 backdrop-blur-md transition-all"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          {hasMultipleCameras && (
            <button
              onClick={toggleCamera}
              className="p-3 rounded-full bg-black/20 border border-white/10 text-white hover:bg-black/40 backdrop-blur-md transition-all"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

    </div>
  );
}