/**
 * 面部识别模型预加载工具
 * 
 * 在用户进入问卷时后台预加载 face-api 和 MediaPipe 模型
 * 这样当用户完成问卷进入拍照步骤时，模型已经加载完毕，提升体验
 */

/** 跟踪预加载状态 */
let faceApiPreloadPromise: Promise<any> | null = null;
let mediaPipePreloadPromise: Promise<any> | null = null;

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
 * 预加载 MediaPipe FaceLandmarker 模型
 * 用于 VIP 用户的高级分析功能
 */
export function preloadMediaPipe() {
  // 避免重复加载
  if (mediaPipePreloadPromise) {
    return mediaPipePreloadPromise;
  }

  mediaPipePreloadPromise = (async () => {
    try {
      console.log("[Preload] Starting MediaPipe FaceLandmarker preload...");
      const startTime = performance.now();

      // 导入 initFaceLandmarker 并触发初始化
      const { initFaceLandmarker } = await import("@/lib/mediapipe-utils");
      await initFaceLandmarker();

      const duration = performance.now() - startTime;
      console.log(`[Preload] MediaPipe FaceLandmarker loaded successfully (${duration.toFixed(0)}ms)`);
      return true;
    } catch (err) {
      console.error("[Preload] Failed to preload MediaPipe:", err);
      // 不抛出错误，MediaPipe 是可选的（VIP 专属功能）
      return false;
    }
  })();

  return mediaPipePreloadPromise;
}

/**
 * 预加载所有面部识别相关模型
 * 在进入问卷时调用，这样在用户完成问卷进入拍照时模型就已就绪
 */
export function preloadAllFaceModels() {
  console.log("[Preload] Starting all face detection models preload...");
  
  // 并行启动两个预加载任务，不等待它们完成
  preloadFaceApi();
  preloadMediaPipe();
  
  // 如果需要等待都完成，可以这样做：
  // return Promise.all([preloadFaceApi(), preloadMediaPipe()]);
}
