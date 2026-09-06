"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { useAdvisorAnalytics } from "@/hooks/useAdvisorAnalytics";
import type * as FaceApi from "@vladmandic/face-api";

const DEBUG = process.env.NODE_ENV === 'development';

type FaceApiModule = typeof FaceApi;

// 四张照片的数据结构
export interface FaceCaptureImages {
  front: string;
  left: string;
  right: string;
  chin: string;
}

interface FaceCaptureProps {
  onCapture: (images: FaceCaptureImages) => Promise<void> | void;
  onModelsLoaded?: () => void;
  externalFaceApi?: FaceApiModule; // 外部预加载的 face-api 实例
}

type LightLevel = "excellent" | "good" | "low" | "too_dark" | "too_bright" | "uneven" | "unknown";
type FaceStatus = "none" | "detecting" | "found" | "ready" | "success";

// 拍照步骤类型
type CaptureStep = "front" | "left" | "right" | "chin";

// 头部朝向类型
type HeadPose = "front" | "left" | "right" | "chin" | "unknown";

// 头部姿态判定阈值配置（便于后续 A/B 校准或外部配置）
const HEAD_POSE_THRESHOLDS = {
  lookingLeft: 0.10,
  lookingRight: -0.10,
  centerHorizontal: 0.30,
  chinNoseOffsetMax: 0.30,
  chinTiltMax: 0.15,
};

// 下颚（抬头）检测阈值：改为「与用户正脸实测基准的差值」判定
// 原因：正常平视 tiltRatio 在 0.25~0.55 之间波动，旧绝对阈值 0.35 恰好落在波动区间内，
// 导致用户尚未抬头就被误判为 chin（过于灵敏）。
// 现以正脸步骤拍摄瞬间实测的 tiltRatio 为个人基准，抬头需低于基准 CHIN_PITCH_DELTA 以上；
// 无基准（异常路径）时用 CHIN_PITCH_FALLBACK_THRESHOLD（低于平视波动下沿 0.25）兜底。
const CHIN_PITCH_DELTA = 0.15;
const CHIN_PITCH_FALLBACK_THRESHOLD = 0.22;

// 光线不足阈值：低于此值时禁止自动拍摄，但允许手动拍照
// 取值 0-1；0.08 对应约 20 的灰度值，比原 0.15 更宽松，适应更多室内场景
const MIN_LIGHT_LEVEL_FOR_AUTO_CAPTURE = 0.08;
// 光线分析节流间隔（ms），避免主线程被密集计算阻塞
const LIGHT_ANALYSIS_INTERVAL_MS = 250;
// 手动拍照按钮延迟：用户进入某一步骤后等待多久显示“手动拍照”
const MANUAL_BUTTON_DELAY_MS = 3000; // 3 秒，比原 5 秒更友好
// 若持续未检测到面部，提前显示手动拍照按钮
const NO_FACE_MANUAL_BUTTON_DELAY_MS = 5000;

// 闭眼检测阈值：EAR（眼纵横比）低于此值判定为闭眼，禁止自动拍摄
// 0.18 比文献常用 0.20 略宽松，兼容眼睛偏小的亚洲人群；取双眼最大值避免侧脸步骤远侧眼遮挡误判
const EYE_CLOSED_EAR_THRESHOLD = 0.18;
// 模糊检测：拉普拉斯方差低于此值判定为画面模糊，禁止自动拍摄（阈值从宽，仅供 A/B 校准）
const MIN_SHARPNESS_VARIANCE = 40;
// 模糊分析节流间隔（ms），画框区域 64x64 下采样，开销很小
const BLUR_ANALYSIS_INTERVAL_MS = 500;
// 无脸超过该时长后，检测间隔拉到 500ms 节能降热
const NO_FACE_IDLE_THRESHOLD_MS = 3000;
const NO_FACE_IDLE_INTERVAL_MS = 500;

// 步骤配置
const CAPTURE_STEPS: { step: CaptureStep; label: string; instruction: string; icon: React.ReactNode }[] = [
  { step: "front", label: "正脸", instruction: "请正对镜头", icon: <User className="h-6 w-6" /> },
  { step: "left", label: "右转", instruction: "请向右转头", icon: <ChevronLeft className="h-6 w-6" /> },
  { step: "right", label: "左转", instruction: "请向左转头", icon: <ChevronRight className="h-6 w-6" /> },
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
  const router = useRouter();
  const { trackFaceScanStep } = useAdvisorAnalytics();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceDetectionRef = useRef<number | null>(null);
  const stableCountRef = useRef<number>(0);
  const cooldownRef = useRef<boolean>(false); // 步骤切换冷却标志
  const lastSpeakTimeRef = useRef<number>(0); // 语音防抖时间戳
  const lastSpokenPhraseRef = useRef<string>(""); // 避免短时间内重复播报同一句话
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null); // 冷却进度定时器
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 成功提示定时器

  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<Record<CaptureStep, string | null>>({
    front: null,
    left: null,
    right: null,
    chin: null,
  });
  const capturedImagesRef = useRef(capturedImages);
  const [currentStep, setCurrentStep] = useState<CaptureStep>("front");
  const currentStepRef = useRef(currentStep);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const facingModeRef = useRef(facingMode);
  const [lightLevel, setLightLevel] = useState<LightLevel>("unknown");
  const lightLevelRef = useRef(lightLevel);
  const [error, setError] = useState<string | null>(null);
  const [stabilityProgress, setStabilityProgress] = useState<number>(0); // 姿势稳定进度 0-100
  const [isInCooldown, setIsInCooldown] = useState<boolean>(false); // 冷却状态 UI 显示
  // cooldownProgress 已移除：UI 未使用，避免无意义的状态更新
  const [isMuted, setIsMuted] = useState(false); // 静音状态
  const isMutedRef = useRef(isMuted);
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }); // 减少动效偏好（初始值通过函数避免 effect 同步 setState）
  const reducedMotionRef = useRef(reducedMotion);
  const [showSuccessForStep, setShowSuccessForStep] = useState<CaptureStep | null>(null); // 拍摄成功确认态
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(isLoading);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false); // 切换摄像头中
  const [faceStatus, setFaceStatus] = useState<FaceStatus>("none");
  const [showManualButton, setShowManualButton] = useState(false); // 是否显示手动拍照按钮
  const [qualityHint, setQualityHint] = useState<string | null>(null); // 质量提示（闭眼/模糊）
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [isAllCaptured, setIsAllCaptured] = useState(false);
  const isAllCapturedRef = useRef(isAllCaptured);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(navigator.userAgent);
  });
  const [modelLoadFailed, setModelLoadFailed] = useState(false); // 模型加载失败状态
  const modelLoadFailedRef = useRef(modelLoadFailed);
  const faceApiRef = useRef<FaceApiModule | null>(null);
  // 检测循环回调 ref，避免依赖变化导致 requestAnimationFrame 重启
  const detectFaceRef = useRef<() => Promise<void>>(async () => {});
  // 保存最新的面部检测框，用于裁剪
  const faceBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  // 摄像头初始化调用ID，防竞态
  const initCallIdRef = useRef(0);
  // 面部检测并发锁
  const isDetectingRef = useRef(false);
  // 语音锁定截止时间
  const speakLockUntilRef = useRef<number>(0);
  // 当前正在播放的语音 utterance，用于步骤切换时等待前一条播放完毕
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // 当前步骤开始时间，用于手动按钮计时
  const stepStartTimeRef = useRef<number>(0);
  // 最近一次检测到面部的时间，用于无脸时提前显示手动按钮
  // 初始值 0，挂载时在 effect 中初始化为当前时间（避免 render 期间调用 Date.now 不纯函数）
  const lastFaceDetectedRef = useRef<number>(0);
  // 冷却结束后的静默期截止时间，给用户调整姿势的缓冲
  const cooldownGracePeriodUntilRef = useRef<number>(0);
  // 标记刚完成拍照的时间戳，用于语音时序对齐
  const justCapturedRef = useRef<number | null>(null);
  // 动态检测间隔：根据设备性能自适应，避免低端机掉帧
  // 档位整体放宽（最快 100ms、最慢 300ms），为触摸事件留出主线程时间
  const detectionIntervalRef = useRef(100);
  const detectionTimesRef = useRef<number[]>([]);
  // 解决 takePhotoAuto 在 detectFace 之前被访问的闭包问题
  const takePhotoAutoRef = useRef<(mode?: "auto" | "manual") => void>(() => {});
  // 光线分析最后运行时间，用于节流
  const lastLightAnalysisRef = useRef<number>(0);
  // 光线亮度数值 (0-1)，供检测循环判断是否能自动拍照
  const lightBrightnessRef = useRef<number>(1);
  // 模糊分析最后运行时间，用于节流
  const lastBlurAnalysisRef = useRef<number>(0);
  // 画面清晰度判定结果（默认 true：未知/无脸时不拦截，仅在明确模糊时禁止自动拍摄）
  const isFrameSharpRef = useRef<boolean>(true);
  // 正脸步骤实测的 tiltRatio 基准（抬头判定的个人化参照）
  const baselineTiltRatioRef = useRef<number | null>(null);
  // 最近一次检测的 tiltRatio（供正脸拍摄时写入基准）
  const lastTiltRatioRef = useRef<number>(0.5);
  // 屏幕常亮锁
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const trackMuteListenersRef = useRef<{ track: MediaStreamTrack; onMute: () => void; onUnmute: () => void } | null>(null);
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

  // 检测用户是否偏好减少动效（同步影响震动与语音播报）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // 保持 ref 与最新状态同步，供检测循环使用（避免 loop 因依赖变化而重启）
  useEffect(() => { capturedImagesRef.current = capturedImages; }, [capturedImages]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { facingModeRef.current = facingMode; }, [facingMode]);
  useEffect(() => { lightLevelRef.current = lightLevel; }, [lightLevel]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { isAllCapturedRef.current = isAllCaptured; }, [isAllCaptured]);
  useEffect(() => { modelLoadFailedRef.current = modelLoadFailed; }, [modelLoadFailed]);

  // 挂载时初始化“最近检测到面部的时间”为当前时间（避免 render 期间调用 Date.now）
  useEffect(() => {
    lastFaceDetectedRef.current = Date.now();
  }, []);
  /**
   * 初始化摄像头
   * 注意：禁用美颜效果，确保获取原始相机画面用于AI肌肤分析
   */
  const initCamera = useCallback(async () => {
    // 切换摄像头时不重复显示初始加载遮罩，只显示切换中状态
    if (!isSwitchingCamera) {
      setIsLoading(true);
    }
    setError(null);
    const callId = ++initCallIdRef.current;

    // 权限弹窗挂起（用户不点允许/拒绝）时 getUserMedia 永不 resolve，
    // 20s 超时兜底给出可操作的错误态而非无限转圈
    const initTimeout = setTimeout(() => {
      if (callId !== initCallIdRef.current) return;
      setError("摄像头启动超时，请检查浏览器权限弹窗后重试");
      setIsLoading(false);
      setIsSwitchingCamera(false);
    }, 20000);

    // 非 HTTPS 或旧 webview 中 navigator.mediaDevices 可能为 undefined，走独立错误文案而非抛 TypeError
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      clearTimeout(initTimeout);
      setError("当前环境不支持摄像头，请使用 HTTPS 访问或更换浏览器后重试");
      setIsLoading(false);
      setIsSwitchingCamera(false);
      return;
    }

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

      // 构建基础约束 + 可选 facingMode
      const baseConstraints = (withFacingMode: boolean, mode?: "user" | "environment") => ({
        video: withFacingMode
          ? { facingMode: mode || facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, min: 15 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, min: 15 } },
      });

      const oppositeFacingMode = facingMode === "user" ? "environment" : "user";

      // 尝试多组分辨率，从优到劣；优先带 facingMode，失败时移除 facingMode 或尝试反向摄像头，再降级到任意摄像头
      const constraintsList = [
        baseConstraints(true, facingMode),
        { video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 15 } } },
        { video: { facingMode, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30, min: 15 } } },
        baseConstraints(true, oppositeFacingMode),
        { video: { facingMode: oppositeFacingMode, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 15 } } },
        { video: { facingMode: oppositeFacingMode, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30, min: 15 } } },
        { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, min: 15 } } },
        { video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 15 } } },
        { video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30, min: 15 } } },
        { video: true },
      ];

      let lastError: Error | null = null;
      for (const constraints of constraintsList) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          lastError = null;
          if (DEBUG) {
            console.log("Camera constraints matched:", JSON.stringify(constraints));
          }
          break;
        } catch (e) {
          lastError = e as Error;
          if ((e as Error)?.name !== 'OverconstrainedError') throw e;
          // 继续尝试更低要求
        }
      }

      if (lastError) throw lastError;

      // 竞态保护：如果 facingMode 在此期间已变化，丢弃本次结果
      if (callId !== initCallIdRef.current) {
        mediaStream!.getTracks().forEach(t => t.stop());
        return;
      }

      const videoTrack = mediaStream!.getVideoTracks()[0];
      if (DEBUG) {
        console.log("Camera stream obtained:", mediaStream!.id, videoTrack?.label, "muted:", videoTrack?.muted);
      }

      // 安全地关闭非标准美颜/增强约束，避免部分设备黑屏；仅当设备明确支持时才应用
      if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
        try {
          const caps = videoTrack.getCapabilities() as Record<string, unknown>;
          const advanced: MediaTrackConstraintSet[] = [];
          if ('beautificationMode' in caps) {
            advanced.push({ beautificationMode: "off" } as MediaTrackConstraintSet);
          }
          if ('imageEnhancement' in caps) {
            advanced.push({ imageEnhancement: false } as MediaTrackConstraintSet);
          }
          if (advanced.length > 0) {
            await videoTrack.applyConstraints({ advanced });
            if (DEBUG) console.log("Applied safe beautification constraints:", advanced);
          }
        } catch (e) {
          if (DEBUG) {
            console.warn("Could not apply beautification constraints:", e);
          }
        }
      }

      // 监听 track muted 状态（如摄像头被其他应用抢占时给出提示）
      if (videoTrack) {
        const onMute = () => {
          console.warn("Camera track muted — camera may be in use by another app or hardware disabled.");
        };
        const onUnmute = () => {
          if (DEBUG) console.log("Camera track unmuted.");
        };
        videoTrack.addEventListener("mute", onMute);
        videoTrack.addEventListener("unmute", onUnmute);
        trackMuteListenersRef.current = { track: videoTrack, onMute, onUnmute };
      }

      streamRef.current = mediaStream!;
      setStream(mediaStream!);
      clearTimeout(initTimeout);
      // 超时兜底可能已先置过错误态，流真正到达时清除
      setError(null);
      setIsLoading(false);
      setIsSwitchingCamera(false);
    } catch (err) {
      clearTimeout(initTimeout);
      // 竞态保护：忽略过期的错误
      if (callId !== initCallIdRef.current) return;

      console.error("Camera error:", err);

      if ((err as Error)?.name === 'AbortError') {
        if (DEBUG) {
          console.warn("Camera init interrupted, ignoring.");
        }
        setIsSwitchingCamera(false);
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
      setIsSwitchingCamera(false);
    }
  }, [facingMode, isSwitchingCamera]);

  // 始终指向最新的 initCamera，避免将 initCamera 放入 effect 依赖导致循环触发
  const initCameraRef = useRef(initCamera);
  useEffect(() => {
    initCameraRef.current = initCamera;
  }, [initCamera]);

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
      if (DEBUG) {
        console.log("Face detection models reused from preload");
      }
      onModelsLoaded?.();
      return;
    }

    try {
      // 动态导入 @vladmandic/face-api
      const faceapi = await import("@vladmandic/face-api");
      faceApiRef.current = faceapi;

      // 从本地加载 TinyFaceDetector 和 faceLandmark68Net 模型
      const loadPromise = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      ]);

      try {
        // 15 秒内未完成则先降级为手动拍照，避免用户无限等待
        await Promise.race([
          loadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("模型加载超时")), 15000))
        ]);

        setModelsLoaded(true);
        setFaceApiLoaded(true);
        setModelLoadFailed(false);
        if (DEBUG) {
          console.log("Face detection models loaded (including landmarks)");
        }
        onModelsLoaded?.();
      } catch (timeoutErr) {
        console.error("Failed to load face detection:", timeoutErr);
        setModelsLoaded(false);
        setModelLoadFailed(true);
        // 已进入手动拍照降级模式，通知页面关闭全屏准备遮罩，避免遮罩永不消失
        onModelsLoaded?.();
        // 恢复路径：超时只是"等不及"，后台加载仍会继续。
        // 若模型最终加载成功（如网络慢），自动恢复自动检测状态，
        // 避免用户永久停留在"手动拍照"降级模式。
        loadPromise
          .then(() => {
            setModelsLoaded(true);
            setFaceApiLoaded(true);
            setModelLoadFailed(false);
            if (DEBUG) {
              console.log("Face detection models loaded after timeout, auto-detection restored");
            }
            onModelsLoaded?.();
          })
          .catch(() => {
            // 真实加载失败，保持手动拍照降级模式
          });
      }
    } catch (err) {
      console.error("Failed to load face detection:", err);
      setModelsLoaded(false);
      setModelLoadFailed(true);
      // 已进入手动拍照降级模式，通知页面关闭全屏准备遮罩，避免遮罩永不消失
      onModelsLoaded?.();
    }
  }, [faceApiLoaded, externalFaceApi, onModelsLoaded]);

  /**
   * 计算仰头指标 tiltRatio：鼻尖到眼连线垂距 / 眼到下巴垂距（越小越仰头）
   * 与 detectFace 共用，保证判定与调试输出一致
   */
  const calculateTiltRatio = useCallback((positions: { x: number; y: number }[]): number => {
    if (!positions || positions.length < 46) return 0.5;
    const noseTip = positions[30];
    const leftEyeOuter = positions[36];
    const rightEyeOuter = positions[45];
    const chin = positions[8];
    const eyesCenterY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
    const noseToEyesY = noseTip.y - eyesCenterY;
    const eyesToChinY = chin.y - eyesCenterY;
    return eyesToChinY !== 0 ? noseToEyesY / eyesToChinY : 0.5;
  }, []);

  /**
   * 根据面部关键点计算头部朝向
   * 使用鼻尖和眼睛位置来判断头部方向
   * 包含左右转头和仰头（下颚）检测
   */
  const calculateHeadPose = useCallback((landmarks: { positions: { x: number; y: number }[] }, targetStep: CaptureStep, facingMode: "user" | "environment" = "user"): HeadPose => {
    const positions = landmarks.positions;

    // 68点面部关键点索引：位置16/30/36/45必须存在，面部宽度不能为0
    if (!positions || positions.length < 46) return "unknown";

    const leftEyeOuter = positions[36];
    const rightEyeOuter = positions[45];
    const noseTip = positions[30];
    const faceLeft = positions[0];
    const faceRight = positions[16];

    const faceWidth = faceRight.x - faceLeft.x;
    if (faceWidth <= 0) return "unknown";

    const eyesCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2;

    let noseOffsetRatio = (noseTip.x - eyesCenterX) / faceWidth;

    // 前置摄像头预览做了 CSS 镜像；为了让检测与用户镜像视角的“左/右”一致，
    // 对用户-facing 摄像头反转水平偏移的符号。
    if (facingMode === "user") {
      noseOffsetRatio = -noseOffsetRatio;
    }

    // 仰头指标：鼻尖到眼连线垂距 / 眼到下巴垂距（越小越仰头）
    const tiltRatio = calculateTiltRatio(positions);

    // --- 判定逻辑 ---

    // 基础标志位
    // 收紧阈值，确保多角度照片质量，提升 AI 分析准确性
    const isLookingLeft = noseOffsetRatio > HEAD_POSE_THRESHOLDS.lookingLeft;
    const isLookingRight = noseOffsetRatio < HEAD_POSE_THRESHOLDS.lookingRight;
    const isLookingCenter = Math.abs(noseOffsetRatio) < HEAD_POSE_THRESHOLDS.centerHorizontal;

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
      // 抬头检测：以用户正脸实测 tiltRatio 为基准，抬头需低于基准 CHIN_PITCH_DELTA 以上。
      // 绝对阈值落在平视波动区间（0.25~0.55）内是旧版"太灵敏"的根因，改为基准差值后
      // 只有真正做出抬头动作（明显低于个人平视值）才会触发。
      const baseline = baselineTiltRatioRef.current;
      const threshold = baseline !== null ? baseline - CHIN_PITCH_DELTA : CHIN_PITCH_FALLBACK_THRESHOLD;
      if (tiltRatio < threshold && Math.abs(noseOffsetRatio) < HEAD_POSE_THRESHOLDS.chinNoseOffsetMax) {
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
  }, [calculateTiltRatio]);

  /**
   * 计算眼纵横比（EAR）：左眼 36-41，右眼 42-47
   * 返回两只眼睛中较开的一只的 EAR，避免侧脸步骤远侧眼被遮挡导致的误判
   */
  const calculateEyeAspectRatio = useCallback((positions: { x: number; y: number }[]): number => {
    if (!positions || positions.length < 48) return 1;

    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const leftHorizontal = dist(positions[36], positions[39]);
    const rightHorizontal = dist(positions[42], positions[45]);
    // 水平距离异常（0 或极小）时视为睁眼，避免除零误判
    if (leftHorizontal < 1 || rightHorizontal < 1) return 1;

    const leftEAR =
      (dist(positions[37], positions[41]) + dist(positions[38], positions[40])) /
      (2 * leftHorizontal);
    const rightEAR =
      (dist(positions[43], positions[47]) + dist(positions[44], positions[46])) /
      (2 * rightHorizontal);

    return Math.max(leftEAR, rightEAR);
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
  const speak = useCallback((text: string): SpeechSynthesisUtterance | null => {
    if (isMutedRef.current || reducedMotionRef.current || typeof window === 'undefined') return null;
    try {
      // 防止同一个指令在短时间内重复堆积
      if (window.speechSynthesis.speaking && text === lastSpokenPhraseRef.current) {
        return null;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 1.0;
      utterance.volume = 1.0;

      // 追踪当前 utterance，便于步骤切换时等待前一条播放完毕
      currentUtteranceRef.current = utterance;
      utterance.onend = () => {
        if (currentUtteranceRef.current === utterance) {
          currentUtteranceRef.current = null;
        }
      };

      window.speechSynthesis.speak(utterance);
      return utterance;
    } catch (e) {
      console.error("Speech synthesis failed", e);
      return null;
    }
  }, []);

  /**
   * 检测面部和头部朝向
   * 使用 ref 读取可变状态，避免每次状态变化都重启 requestAnimationFrame 循环。
   */
  const detectFace = async () => {
    if (cooldownRef.current || isDetectingRef.current) return;
    if (!videoRef.current || !faceApiRef.current || !modelsLoaded || isAllCapturedRef.current || isLoadingRef.current || modelLoadFailedRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) return;

    isDetectingRef.current = true;
    const detectStart = performance.now();

    try {
      const faceapi = faceApiRef.current;
      // 移动设备降低输入分辨率（416→320），降低单帧推理耗时，避免主线程被占满导致触摸事件排队
      const isMobileInput = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: isMobileInput ? 320 : 416, scoreThreshold: 0.3 }))
        .withFaceLandmarks();

      if (detection) {
        lastFaceDetectedRef.current = Date.now();

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
          facingModeRef.current
        );

        // 检查面部是否在椭圆框内（仅作为视觉引导，不作为硬性拍照门槛）
        const isInEllipse = isFaceInEllipse(displayBox, displayWidth, displayHeight);

        // 检查面部大小是否合适——大幅放宽，能拍到就行
        const ellipseHeight = videoHeight * 0.70;
        const faceToEllipseRatio = box.height / ellipseHeight;
        const isSizeOk = faceToEllipseRatio > 0.15 && faceToEllipseRatio < 1.05;

        const currentStep = currentStepRef.current;
        // 计算头部朝向 (传入 currentStep 以优化判定逻辑；前置摄像头时反转水平偏移以匹配镜像视角)
        const headPose = calculateHeadPose(detection.landmarks, currentStep, facingModeRef.current);

        // 检查当前头部朝向是否匹配当前步骤
        const isPoseCorrect = headPose === currentStep;

        // 闭眼检测（EAR）：双眼均闭合时判定为闭眼，禁止自动拍摄
        const eyeAspectRatio = calculateEyeAspectRatio(detection.landmarks.positions);
        const isEyesOpen = eyeAspectRatio >= EYE_CLOSED_EAR_THRESHOLD;

        // 画面清晰度（拉普拉斯方差，由独立节流任务 analyzeFrameSharpness 更新）
        const isSharp = isFrameSharpRef.current;

        // 记录最近一次仰头指标，正脸拍摄瞬间将写入个人基准（用于 chin 步判定）
        const tiltRatio = calculateTiltRatio(detection.landmarks.positions);
        lastTiltRatioRef.current = tiltRatio;

        // 调试信息
        if (DEBUG) {
          const positions = detection.landmarks.positions;
          const leftEyeOuter = positions[36];
          const rightEyeOuter = positions[45];
          const noseTip = positions[30];
          const faceLeft = positions[0];
          const faceRight = positions[16];
          const eyesCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2;
          const faceWidth = faceRight.x - faceLeft.x;
          let noseOffsetRatio = (noseTip.x - eyesCenterX) / faceWidth;
          if (facingModeRef.current === "user") noseOffsetRatio = -noseOffsetRatio;
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

        // 稳定帧数要求：普通步骤需 5 帧（~250ms），给用户"定住"的心理预期
        // 下颚（抬头）步骤容易误判，需要更多稳定帧
        const requiredFrames = currentStep === 'chin' ? 7 : 5;
        const progressFrames = currentStep === 'chin' ? 8 : 6;

        // 核心拍照条件：姿势正确 + 大小基本合适 + 光线足够 + 睁眼 + 画面清晰
        //（光线不足/闭眼/模糊时仍可手动拍照）
        const isLightSufficient = lightBrightnessRef.current >= MIN_LIGHT_LEVEL_FOR_AUTO_CAPTURE;
        const canCapture = isSizeOk && isPoseCorrect && isLightSufficient && isEyesOpen && isSharp;

        if (canCapture) {
          // 冷却结束后的静默期内：检测正常进行但不累加 stableCount，给用户调整姿势的缓冲
          const inGracePeriod = Date.now() < cooldownGracePeriodUntilRef.current;
          if (!inGracePeriod) {
            stableCountRef.current += 1;
          }
          setFaceStatus((prev) => (prev === "found" ? prev : "found"));
          setQualityHint((prev) => (prev === null ? prev : null));

          // 更新稳定进度：统一使用 progressFrames 作为分母，避免进度回跳
          // 取整后与旧值相同则跳过 setState，减少检测高频回调带来的无效重渲染
          setStabilityProgress((prev) => {
            const next = Math.round(Math.min(100, (stableCountRef.current / progressFrames) * 100));
            return prev === next ? prev : next;
          });

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

            // 冷却会在 takePhotoAuto 入口处立即设置，这里不再提前重置 stableCount
            takePhotoAutoRef.current("auto");
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
          // 使用与正向累加相同的 progressFrames 分母，避免进度回跳
          setStabilityProgress((prev) => {
            const next = Math.round(Math.min(100, (stableCountRef.current / progressFrames) * 100));
            return prev === next ? prev : next;
          });
          setFaceStatus((prev) => (prev === "detecting" ? prev : "detecting"));

          // 质量提示：仅姿势正确时展示闭眼/模糊原因（姿势错误由主指令与语音引导，光线由底部指示器提示）
          const hint =
            isPoseCorrect && !isEyesOpen
              ? "请睁大眼睛"
              : isPoseCorrect && !isSharp && isLightSufficient
                ? "画面模糊，请保持手机稳定"
                : null;
          setQualityHint((prev) => (prev === hint ? prev : hint));

          const now = Date.now();
          if (now > speakLockUntilRef.current && now - lastSpeakTimeRef.current > 6000) {
            let feedback = "";
            if (!isPoseCorrect) {
              if (currentStep === "left") {
                feedback = "请向右转头";
              } else if (currentStep === "right") {
                feedback = "请向左转头";
              } else if (currentStep === "chin") {
                feedback = "请稍微抬头";
              } else if (currentStep === "front") {
                feedback = "请正对镜头";
              }
            } else if (!isEyesOpen) {
              feedback = "请睁大眼睛";
            } else if (!isSharp && isLightSufficient) {
              feedback = "画面模糊，请保持手机稳定";
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

        setFaceStatus((prev) => (prev === "detecting" ? prev : "detecting"));
      }
    } catch (err) {
      console.error("Face detection error:", err);
    } finally {
      isDetectingRef.current = false;

      // 动态调整检测间隔：根据设备实际推理耗时自适应
      const detectDuration = performance.now() - detectStart;
      detectionTimesRef.current.push(detectDuration);
      if (detectionTimesRef.current.length > 10) {
        detectionTimesRef.current.shift();
      }
      if (detectionTimesRef.current.length >= 3) {
        const avg = detectionTimesRef.current.reduce((a, b) => a + b, 0) / detectionTimesRef.current.length;
        if (avg > 60) {
          detectionIntervalRef.current = 300;
        } else if (avg > 35) {
          detectionIntervalRef.current = 200;
        } else if (avg < 20) {
          detectionIntervalRef.current = 100;
        }
      }
    }
  };

  // 保持检测回调最新，供 requestAnimationFrame 循环使用；依赖变化不再重启 loop
  useEffect(() => {
    detectFaceRef.current = detectFace;
  });

  // 监听步骤变化并播报语音指令
  useEffect(() => {
    if (isAllCaptured || isLoading || !modelsLoaded) return;

    const instruction = CAPTURE_STEPS.find(s => s.step === currentStep)?.instruction;
    if (instruction) {
      // 如果刚拍完照（2秒内），延迟更久让"好"先播完，避免打断
      const timeSinceCapture = justCapturedRef.current ? Date.now() - justCapturedRef.current : Infinity;
      const delay = timeSinceCapture < 2000 ? 800 : 500;

      const timer = setTimeout(async () => {
        // 等待前一条语音（如"好"）播放完毕，避免被 cancel 戛然而止
        const pending = currentUtteranceRef.current;
        if (pending) {
          await new Promise<void>((resolve) => {
            const originalOnend = pending.onend;
            pending.onend = (event) => {
              originalOnend?.call(pending, event);
              resolve();
            };
            // 兜底：最多等 600ms，防止 TTS 引擎异常导致无限等待
            setTimeout(resolve, 600);
          });
        }
        // 前一条播放完毕后再 cancel 并播放下一条指令
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
  }, [currentStep, isAllCaptured, isLoading, modelsLoaded, speak]);

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
   * 使用 ref 读取 currentStep/capturedImages，避免 setTimeout 闭包过时。
   */
  const takePhotoAuto = useCallback((mode: "auto" | "manual" = "auto") => {
    if (!videoRef.current || !canvasRef.current || cooldownRef.current) return;

    // 立即进入冷却，防止 detectFace 在异步窗口内再次触发
    cooldownRef.current = true;
    setIsInCooldown(true);
    setQualityHint(null);

    setTimeout(async () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) {
        // 异常情况：恢复冷却标志，避免死锁
        cooldownRef.current = false;
        setIsInCooldown(false);
        return;
      }

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        // 异常情况：恢复冷却标志，避免死锁
        cooldownRef.current = false;
        setIsInCooldown(false);
        return;
      }

    let imageData: string;

    // 辅助函数：将 canvas 异步编码为 data URL，避免 toDataURL 主线程阻塞
    const encodeCanvas = (c: HTMLCanvasElement): Promise<string> =>
      new Promise((resolve) => {
        c.toBlob((blob) => {
          if (!blob) { resolve(c.toDataURL("image/jpeg", 0.75)); return; }
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        }, "image/jpeg", 0.75);
      });

    const doCapture = async () => {
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

        // 前置摄像头不再做水平镜像，上传给 AI 的图像与摄像头原始帧保持一致
        ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
      } else {
        // 没有面部检测框，使用原始方式
        canvas.width = videoWidth;
        canvas.height = videoHeight;

        ctx.drawImage(video, 0, 0);
      }

      imageData = await encodeCanvas(canvas);
    };

    await doCapture();

    // 从 ref 读取当前步骤，避免闭包过时
    const step = currentStepRef.current;

    // 保存当前步骤的照片
    setCapturedImages(prev => ({
      ...prev,
      [step]: imageData,
    }));

    // 单步完成埋点（漏斗分析：各角度完成率、手动/自动占比）
    trackFaceScanStep(step, mode);

    // 播报拍照成功反馈，先清空队列避免旧指令滞后
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speak("好");

    // 震动反馈（支持移动设备），弥补 TTS 不可靠的场景
    if (!reducedMotionRef.current && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }

    justCapturedRef.current = Date.now(); // 标记刚拍完，用于下一步语音延迟对齐

    stableCountRef.current = 0;
    faceBoxRef.current = null; // 重置面部框

    // 检查是否还有下一步
    const nextStep = getNextStep(step);

    // 成功提示持续 1200ms（绿环闭合 0.5s + 对勾弹出，留出从容观看时间）
    const successDisplayDuration = 1200;

    if (nextStep) {
      // 冷却已在 takePhotoAuto 入口处设置，这里只需展示成功状态
      // ★ 拍摄成功确认：先展示完成状态，再进入下一步
      setFaceStatus("success");
      setShowSuccessForStep(step);

      successTimerRef.current = setTimeout(() => {
        setFaceStatus("none");
        setShowSuccessForStep(null);
        setStabilityProgress(0);

        // 进入下一步，同时重置手动按钮计时
        stepStartTimeRef.current = Date.now();
        setShowManualButton(false);
        setCurrentStep(nextStep);

        // 冷却期：给用户足够的准备时间，避免刚切换完就误拍
        const cooldownDuration = nextStep === 'chin' ? 1200 : 800;
        const progressInterval = 50;
        let elapsed = 0;

        // Clear any existing timer first
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }

        progressTimerRef.current = setInterval(() => {
          elapsed += progressInterval;

          if (elapsed >= cooldownDuration) {
            if (progressTimerRef.current) {
              clearInterval(progressTimerRef.current);
              progressTimerRef.current = null;
            }
            cooldownRef.current = false;
            setIsInCooldown(false);
            // 冷却结束后增加 400ms 静默期，让用户有时间调整姿势
            cooldownGracePeriodUntilRef.current = Date.now() + 400;
          }
        }, progressInterval);

        successTimerRef.current = null;
      }, successDisplayDuration);

    } else {
      // ★ 最后一张也显示拍摄成功提示
      setFaceStatus("success");
      setShowSuccessForStep(step);

      successTimerRef.current = setTimeout(async () => {
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

        // 从 ref 读取已拍照片，避免 setTimeout 闭包过时
        const allImages: FaceCaptureImages = {
          front: step === "front" ? imageData : capturedImagesRef.current.front!,
          left: step === "left" ? imageData : capturedImagesRef.current.left!,
          right: step === "right" ? imageData : capturedImagesRef.current.right!,
          chin: step === "chin" ? imageData : capturedImagesRef.current.chin!,
        };

        // 校验四个角度是否全部非空；若缺失则回到缺失步骤重拍，避免传空图给下游
        const missingStep = (["front", "left", "right", "chin"] as CaptureStep[]).find((k) => !allImages[k]);
        if (missingStep) {
          console.error("[FaceCapture] Missing capture angle", missingStep);
          setError(`拍摄数据不完整，请重新拍摄${CAPTURE_STEPS.find(s => s.step === missingStep)?.label}照片`);
          setIsAllCaptured(false);
          setCurrentStep(missingStep);
          setFaceStatus("none");
          setShowSuccessForStep(null);
          setStabilityProgress(0);
          stableCountRef.current = 0;
          cooldownRef.current = false;
          setIsInCooldown(false);
          stepStartTimeRef.current = Date.now();
          setShowManualButton(false);
          successTimerRef.current = null;
          return;
        }

        try {
          await onCapture(allImages);
        } catch (err) {
          console.error("[FaceCapture] onCapture failed, resetting capture state:", err);
          // 父级处理失败（如资源加载失败），重置拍摄状态，由错误浮层引导用户重试
          setIsAllCaptured(false);
          setError("处理未成功，请重新拍摄");
          setFaceStatus("none");
          setShowSuccessForStep(null);
          setStabilityProgress(0);
          stableCountRef.current = 0;
          cooldownRef.current = false;
          setIsInCooldown(false);
          stepStartTimeRef.current = Date.now();
          setShowManualButton(false);
          successTimerRef.current = null;
          return;
        }

        successTimerRef.current = null;
      }, successDisplayDuration);
    }
    }, 0);
  }, [getNextStep, onCapture, speak, trackFaceScanStep]);

  // 保持 detectFace 始终能访问到最新的 takePhotoAuto，避免闭包过时
  useEffect(() => {
    takePhotoAutoRef.current = takePhotoAuto;
  }, [takePhotoAuto]);

  /**
   * 分析光线条件 - 增强版
   * 检测：亮度、对比度、均匀度
   * 已节流：每 250ms 最多运行一次；使用 50x38 下采样降低主线程压力。
   */
  const analyzeLightLevel = useCallback(() => {
    const now = Date.now();
    if (now - lastLightAnalysisRef.current < LIGHT_ANALYSIS_INTERVAL_MS) return;
    lastLightAnalysisRef.current = now;

    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    // 等待视频就绪，避免 drawImage 抛异常
    if (video.readyState < 2) return;

    const W = 50;
    const H = 38;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    try {
      ctx.drawImage(video, 0, 0, W, H);
    } catch (e) {
      console.warn("[FaceCapture] drawImage failed in analyzeLightLevel:", e);
      return;
    }

    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, W, H);
    } catch (e) {
      console.warn("[FaceCapture] getImageData failed in analyzeLightLevel:", e);
      return;
    }
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
    // 归一化到 0-1，供检测循环做阈值判断
    lightBrightnessRef.current = avgBrightness / 255;

    // 计算标准差（光线均匀度）
    let variance = 0;
    for (const b of brightnessValues) {
      variance += Math.pow(b - avgBrightness, 2);
    }
    const stdDev = Math.sqrt(variance / pixelCount);

    // 计算动态范围（对比度）
    const dynamicRange = maxBrightness - minBrightness;

    // 综合评分计算
    // 阈值已适度放宽：室内普通灯光（avgBrightness 60-200）且无明显逆光即可满足自动拍摄
    let score = 0;
    let level: LightLevel = "unknown";

    // 亮度评分 (0-40分) - 理想范围 80-200（比原 100-180 更宽松）
    if (avgBrightness >= 80 && avgBrightness <= 200) {
      score += 40;
    } else if (avgBrightness >= 60 && avgBrightness <= 220) {
      score += 30;
    } else if (avgBrightness >= 40 && avgBrightness <= 240) {
      score += 15;
    }

    // 均匀度评分 (0-30分) - 标准差越小越好，理想 < 45（比原 < 30 更宽松）
    if (stdDev < 45) {
      score += 30;
    } else if (stdDev < 65) {
      score += 20;
    } else if (stdDev < 85) {
      score += 10;
    }

    // 对比度评分 (0-30分) - 动态范围适中 40-180（比原 60-150 更宽松）
    if (dynamicRange >= 40 && dynamicRange <= 180) {
      score += 30;
    } else if (dynamicRange >= 25 && dynamicRange <= 210) {
      score += 20;
    } else if (dynamicRange >= 15) {
      score += 10;
    }


    // 根据评分和具体问题设置状态
    if (score >= 75) {
      level = "excellent";
    } else if (score >= 55) {
      level = "good";
    } else if (avgBrightness > 230) {
      level = "too_bright";
    } else if (avgBrightness < 40) {
      level = "too_dark";
    } else if (stdDev > 80) {
      level = "uneven";
    } else {
      level = "low";
    }

    setLightLevel(level);
  }, []);

  /**
   * 分析画面清晰度（模糊检测）
   * 对脸部区域做 64x64 下采样灰度化后计算拉普拉斯方差；
   * 方差低于阈值判定为模糊，写入 isFrameSharpRef 供检测循环拦截自动拍摄。
   * 已节流：每 BLUR_ANALYSIS_INTERVAL_MS 最多运行一次。
   */
  const analyzeFrameSharpness = useCallback(() => {
    const now = Date.now();
    if (now - lastBlurAnalysisRef.current < BLUR_ANALYSIS_INTERVAL_MS) return;
    lastBlurAnalysisRef.current = now;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const faceBox = faceBoxRef.current;
    if (!video || !canvas || !faceBox || video.readyState < 2) return;

    const W = 64;
    const H = 64;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // 人脸框四周扩展 10%，减少边界效应
    const padX = faceBox.width * 0.1;
    const padY = faceBox.height * 0.1;
    const sx = Math.max(0, faceBox.x - padX);
    const sy = Math.max(0, faceBox.y - padY);
    const sw = Math.min(faceBox.width + padX * 2, video.videoWidth - sx);
    const sh = Math.min(faceBox.height + padY * 2, video.videoHeight - sy);
    if (sw <= 0 || sh <= 0) return;

    try {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
    } catch (e) {
      console.warn("[FaceCapture] drawImage failed in analyzeFrameSharpness:", e);
      return;
    }

    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, W, H);
    } catch (e) {
      console.warn("[FaceCapture] getImageData failed in analyzeFrameSharpness:", e);
      return;
    }

    const data = imageData.data;
    const gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const j = i * 4;
      gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
    }

    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        const lap =
          4 * gray[idx] -
          gray[idx - 1] -
          gray[idx + 1] -
          gray[idx - W] -
          gray[idx + W];
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }
    const variance = count > 0 ? sumSq / count - (sum / count) ** 2 : 0;
    isFrameSharpRef.current = variance >= MIN_SHARPNESS_VARIANCE;
  }, []);

  /**
   * 切换前后摄像头
   * 切换过程中显示切换状态，并清除之前的错误提示
   */
  const toggleCamera = useCallback(() => {
    setIsSwitchingCamera(true);
    setError(null);
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  // 加载 face-api.js（异步初始化外部模型，必须在 effect 中执行）
  useEffect(() => {
    void loadFaceApi();
  }, [loadFaceApi]);

  // 检测是否有多个摄像头；默认在移动端显示切换按钮，授权后重新枚举以获取标签
  useEffect(() => {
    // 非 HTTPS 或旧 webview 中 mediaDevices 可能不存在
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setHasMultipleCameras(videoInputs.length > 1);
    }).catch(() => {
      // 保持移动端默认显示
    });
  }, []);

  // 视频流绑定到 video 元素；授权成功后重新枚举设备以获取带标签的摄像头列表
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => {
        if (DEBUG) {
          console.warn("Video play error (handled):", e);
        }
      });
      // 重新枚举设备，通常在授权后标签可用
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      }).catch(() => {
        // 保持移动端默认显示
      });
    }
  }, [stream]);

  // 初始化摄像头：仅在 facingMode 变化时重新初始化（通过 ref 调用避免 initCamera 引用变化导致重复触发）
  useEffect(() => {
    void initCameraRef.current();
  }, [facingMode]);

  // 组件卸载时清理摄像头流（stream 切换由 initCamera 内部自行处理旧流停止）
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      const listeners = trackMuteListenersRef.current;
      if (listeners) {
        try { listeners.track.removeEventListener("mute", listeners.onMute); } catch { /* ignore */ }
        try { listeners.track.removeEventListener("unmute", listeners.onUnmute); } catch { /* ignore */ }
        trackMuteListenersRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (video) {
        video.srcObject = null;
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 面部检测循环：依赖项精简，避免 currentStep/facingMode 等变化导致 loop 重启
  useEffect(() => {
    if (!stream || !modelsLoaded || isAllCaptured || isLoading || modelLoadFailed) return;

    let animationId: number;
    let lastDetectionTime = 0;

    const runDetection = (timestamp: number) => {
      // 无脸超过 3 秒后降低检测频率（500ms），减少主线程占用与手机发热；
      // 重新检测到脸后由 detectFace 更新 lastFaceDetectedRef，自动恢复原频率
      const idleMs = Date.now() - lastFaceDetectedRef.current;
      const interval =
        idleMs > NO_FACE_IDLE_THRESHOLD_MS
          ? NO_FACE_IDLE_INTERVAL_MS
          : detectionIntervalRef.current;
      if (timestamp - lastDetectionTime >= interval) {
        detectFaceRef.current();
        lastDetectionTime = timestamp;
      }
      animationId = requestAnimationFrame(runDetection);
    };

    animationId = requestAnimationFrame(runDetection);
    faceDetectionRef.current = animationId;

    const handleVisibility = () => {
      if (document.hidden) {
        if (animationId) { cancelAnimationFrame(animationId); animationId = 0; }
      } else {
        if (!animationId) { lastDetectionTime = 0; animationId = requestAnimationFrame(runDetection); faceDetectionRef.current = animationId; }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [stream, modelsLoaded, isAllCaptured, isLoading, modelLoadFailed]);

  // 定时检测光线（analyzeLightLevel 内部已节流）
  useEffect(() => {
    if (!stream || isAllCaptured) return;

    const interval = setInterval(analyzeLightLevel, 300);
    return () => clearInterval(interval);
  }, [stream, isAllCaptured, analyzeLightLevel]);

  // 定时检测画面清晰度（analyzeFrameSharpness 内部已节流）
  useEffect(() => {
    if (!stream || isAllCaptured || modelLoadFailed) return;

    const interval = setInterval(analyzeFrameSharpness, BLUR_ANALYSIS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [stream, isAllCaptured, modelLoadFailed, analyzeFrameSharpness]);

  // 步骤切换时重置手动拍照按钮；计时到 MANUAL_BUTTON_DELAY_MS（3秒）后显示手动按钮
  useEffect(() => {
    setShowManualButton(false);
    if (isAllCaptured || isLoading || error || isInCooldown || modelLoadFailed) {
      return;
    }

    const remaining = Math.max(0, MANUAL_BUTTON_DELAY_MS - (Date.now() - stepStartTimeRef.current));
    const timer = setTimeout(() => {
      setShowManualButton(true);
    }, remaining);

    return () => clearTimeout(timer);
  }, [isAllCaptured, isLoading, error, isInCooldown, currentStep, modelLoadFailed]);

  // 若长时间未检测到面部，也提前显示手动拍照按钮，避免用户一直卡在当前步骤
  useEffect(() => {
    if (isAllCaptured || isLoading || error || isInCooldown || modelLoadFailed || showManualButton) {
      return;
    }

    const interval = setInterval(() => {
      if (Date.now() - lastFaceDetectedRef.current >= NO_FACE_MANUAL_BUTTON_DELAY_MS) {
        setShowManualButton(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAllCaptured, isLoading, error, isInCooldown, modelLoadFailed, showManualButton]);

  // 人脸捕获期间保持屏幕常亮，NotAllowedError 静默忽略
  useEffect(() => {
    if (!stream || isAllCaptured || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    const requestWakeLock = async () => {
      try {
        const sentinel = await (navigator as unknown as { wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
        wakeLockRef.current = sentinel;
      } catch (e) {
        if (DEBUG) {
          console.warn("Wake lock request failed (ignored):", e);
        }
      }
    };

    requestWakeLock();

    return () => {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [stream, isAllCaptured]);

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
            {CAPTURE_STEPS.map((step) => {
              const isCompleted = capturedImages[step.step] !== null;
              const isCurrent = step.step === currentStep;

              return (
                <div key={step.step} className="flex items-center">
                  <div className={cn(
                    "flex items-center gap-1.5 transition-all duration-300",
                    isCurrent ? "opacity-100" : "opacity-40"
                  )}>
                    {isCompleted ? (
                      <m.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center"
                      >
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                      </m.div>
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
            successStep={showSuccessForStep}
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
              {faceStatus === "success" && showSuccessForStep
                ? `${CAPTURE_STEPS.find(s => s.step === showSuccessForStep)?.label}拍摄完成`
                : isInCooldown
                  ? "下一个动作..."
                  : currentStepConfig?.instruction}
            </h3>

            {/* 辅助状态：光线 和 自动拍照提示 */}
            <div className="flex items-center justify-center gap-4 text-white/60 text-sm font-light">
              {/* 光线指示 */}
              <div className="flex items-center gap-1.5">
                {lightLevel === 'low' || lightLevel === 'too_dark' ? (
                  <>
                    <SunDim className="w-4 h-4 text-yellow-300" />
                    <span className="text-yellow-100">光线不足，请移至明亮处</span>
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

            {/* 质量提示：闭眼/模糊（姿势错误与光线不足分别由主指令和光线指示器负责） */}
            {qualityHint && (
              <p className="mt-2 text-[13px] text-yellow-200 drop-shadow-md">{qualityHint}</p>
            )}
          </m.div>

          {/* 手动拍照按钮 (Fallback) */}
          {(showManualButton || modelLoadFailed) && (
            <div className="pointer-events-auto mt-4">
              <button
                onClick={() => takePhotoAuto("manual")}
                className="px-6 py-2 min-h-[44px] rounded-full border border-white/30 text-white text-sm hover:bg-white/10 transition-colors backdrop-blur-sm touch-manipulation"
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

      {/* 模型加载失败提示 —— pointer-events-none 让点击穿透到底部的手动拍照按钮 */}
      {modelLoadFailed && !isLoading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-8 text-center pointer-events-none">
          <AlertCircle className="h-10 w-10 text-yellow-400 mb-3" />
           <p className="text-white/80 text-sm mb-2">面部检测加载未成功</p>
          <p className="text-white/50 text-xs">您可以点击下方按钮手动拍照</p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-white text-lg font-medium mb-2">拍摄遇到问题</h3>
          <p className="text-white/60 max-w-md mb-8">{error}</p>
          <div className="flex gap-4">
            <button
              onClick={() => router.back()}
              className="px-8 py-3 bg-white/10 border border-white/20 text-white rounded-full text-sm font-medium hover:bg-white/20 backdrop-blur-sm transition-colors"
            >
              返回上一页
            </button>
            <button
              onClick={() => initCameraRef.current()}
              className="px-8 py-3 bg-white text-black rounded-full text-sm font-medium hover:bg-gray-200 shadow-xl transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 摄像头切换 - 右上角 */}
      {!isAllCaptured && !isLoading && (
        <div className="absolute top-8 right-8 z-30 flex gap-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            aria-label={isMuted ? "取消静音" : "静音"}
            className="p-3 rounded-full bg-black/20 border border-white/10 text-white hover:bg-black/40 backdrop-blur-md transition-all"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          {hasMultipleCameras && (
            <button
              onClick={toggleCamera}
              disabled={isSwitchingCamera}
              className={cn(
                "p-3 rounded-full bg-black/20 border border-white/10 text-white backdrop-blur-md transition-all",
                isSwitchingCamera ? "opacity-50 cursor-not-allowed" : "hover:bg-black/40"
              )}
              aria-label="切换摄像头"
            >
              {isSwitchingCamera ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      )}

    </div>
  );
}