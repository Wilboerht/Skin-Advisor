/**
 * 面部识别模型预加载工具
 * 
 * 在用户进入问卷时后台预加载 face-api 模型
 * 这样当用户完成问卷进入拍照步骤时，模型已经加载完毕，提升体验
 */

/** 跟踪预加载状态 */
let faceApiPreloadPromise: Promise<unknown> | null = null;

/**
 * 预加载 face-api.js 模型（TinyFaceDetector + faceLandmark68Net）
 * 不会阻塞调用线程，静默后台加载
 */
export function preloadFaceApi() {
  // 避免重复加载
  if (faceApiPreloadPromise) {
    return faceApiPreloadPromise;
  }

  faceApiPreloadPromise = (async () => {
    try {
      console.log("[Preload] Starting face-api models preload...");
      const startTime = performance.now();
      
      const faceapi = await import("@vladmandic/face-api");

      // 并行加载两个模型
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      ]);

      const duration = performance.now() - startTime;
      console.log(`[Preload] face-api models loaded successfully (${duration.toFixed(0)}ms)`);
      return true;
    } catch (err) {
      console.error("[Preload] Failed to preload face-api models:", err);
      // 不抛出错误，允许应用继续运行，模型在需要时才加载
      return false;
    }
  })();

  return faceApiPreloadPromise;
}

/**
 * 预加载所有面部识别相关模型
 * 在进入问卷时调用，这样在用户完成问卷进入拍照时模型就已就绪
 * 
 * @returns Promise 返回所有预加载任务的结果
 * 可以忽略返回值，或者在需要时 await
 */
export function preloadAllFaceModels(): Promise<void> {
  console.log("[Preload] Starting face detection models preload...");

  // 返回 Promise，但不阻塞调用方
  // 在后台静默加载，即使 Promise reject 也不会抛出错误
  return preloadFaceApi().then(() => undefined).catch(err => {
    console.error("[Preload] face-api model failed to preload:", err);
  });
}
