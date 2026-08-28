/**
 * 面部识别模型预加载工具
 * 
 * 在用户进入问卷时后台预加载 face-api 模型
 * 这样当用户完成问卷进入拍照步骤时，模型已经加载完毕，提升体验
 */

import { logger } from "@/lib/logger";
import { runWhenIdle } from "@/lib/idle";

/** 跟踪预加载状态 */
let faceApiPreloadPromise: Promise<unknown> | null = null;

export function preloadFaceApi() {
  if (faceApiPreloadPromise) {
    return faceApiPreloadPromise;
  }

  faceApiPreloadPromise = (async () => {
    try {
      logger.info("[Preload] Starting face-api models preload...");
      const startTime = performance.now();
      
      const faceapi = await import("@vladmandic/face-api");

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      ]);

      const duration = performance.now() - startTime;
      logger.info(`[Preload] face-api models loaded (${duration.toFixed(0)}ms)`);
      return true;
    } catch (err) {
      logger.error("[Preload] Failed to preload face-api models:", { error: String(err) });
      return false;
    }
  })();

  return faceApiPreloadPromise;
}

export function preloadAllFaceModels(): Promise<void> {
  logger.info("[Preload] Starting face detection models preload...");

  return preloadFaceApi().then(() => undefined).catch(err => {
    logger.error("[Preload] face-api model failed to preload:", { error: String(err) });
  });
}

/** 是否已调度过空闲预加载（防止重复调度） */
let preloadScheduled = false;

/**
 * 在主线程空闲时调度面部模型预加载。
 *
 * face-api/TF.js 的动态 import 会在主线程解析/编译大体积 chunk，
 * 手机上这是数百毫秒到数秒的长任务；若在用户选完性别的瞬间同步启动，
 * 紧随其后的点击（如"上一题"/"退出"）会排在长任务后面，表现为"点了没反应"。
 * 因此改为空闲调度，保证交互响应优先于预加载；
 * Safari 不支持 requestIdleCallback，退化为延迟 setTimeout。
 */
export function scheduleFaceModelPreload(idleTimeout = 5000, fallbackDelay = 2000): void {
  if (preloadScheduled || faceApiPreloadPromise) return;
  preloadScheduled = true;

  runWhenIdle(() => {
    preloadAllFaceModels();
  }, { timeout: idleTimeout, fallbackDelay });
}
