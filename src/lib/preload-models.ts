/**
 * 面部识别模型预加载工具
 * 
 * 在用户进入问卷时后台预加载 face-api 模型
 * 这样当用户完成问卷进入拍照步骤时，模型已经加载完毕，提升体验
 */

import { logger } from "@/lib/logger";

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
