"use client";

import { runWhenIdle } from "@/lib/idle";

/**
 * face-models — 面部检测模型的全局唯一加载器
 *
 * 设计目标（修复"扫到一半突然提示加载失败"的竞态）：
 * - 单飞：任何时刻全站最多一个加载在途，所有调用方共享同一个 promise
 * - 单调收敛：状态只按 idle → loading → ready | failed 前进；
 *   已 ready 后，任何过期链路的失败都不得回退状态
 * - 失败可重试：失败不缓存为最终结果，清空 in-flight 允许下一次重试；
 *   部分失败时只补加载缺失的 net，不重复加载已就绪的那份
 * - 订阅式读取：组件只消费状态，不再各自持有 modelsLoaded/modelLoadFailed 副本
 */

export type FaceModelStatus = "idle" | "loading" | "ready" | "failed";

/** 模型文件目录（public/models，next.config.ts 已配置一年期 immutable 缓存） */
export const FACE_MODEL_URI = "/models";

export interface FaceModelNet {
  readonly isLoaded: boolean;
  loadFromUri: (uri: string) => Promise<void>;
}

/** 两个 net 的最小结构约束：真实 face-api 模块与测试假实现都满足 */
export interface FaceApiLike {
  nets: {
    tinyFaceDetector: FaceModelNet;
    faceLandmark68Net: FaceModelNet;
  };
}

/**
 * 加载看门狗：模型请求挂起（弱网下"不失败也不成功"）时按超时失败处理，
 * 转入 failed → 可重试/手动降级轨道，而不是永远停在 loading。
 * 超时后后台加载仍在继续：若最终成功，api 已就绪，下一次 load() 会直接短路为 ready。
 */
function withLoadTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`face-model load timeout (${ms}ms)`)), ms);
    p.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/** 可注入 loader 的工厂：生产用动态 import，单测注入假模块（node 环境不碰 tfjs） */
export function createFaceModelStore<T extends FaceApiLike>(
  loadModule: () => Promise<T>,
  { loadTimeoutMs = 25000 }: { loadTimeoutMs?: number } = {}
) {
  let api: T | null = null;
  let inflight: Promise<T> | null = null;
  let status: FaceModelStatus = "idle";
  const listeners = new Set<() => void>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const isReady = (mod: T | null): mod is T =>
    !!mod && mod.nets.tinyFaceDetector.isLoaded && mod.nets.faceLandmark68Net.isLoaded;

  const load = (): Promise<T> => {
    // 已就绪直接短路（HMR / 组件重挂载后由模块单例的 isLoaded 还原，不重复下载）。
    // 同步推进 status 并通知订阅者：看门狗超时后后台加载若最终成功，
    // 这里要把 UI 从 failed 拉回 ready，否则用户会卡在降级态
    if (isReady(api)) {
      if (status !== "ready") {
        status = "ready";
        emit();
      }
      return Promise.resolve(api);
    }
    // 单飞：并发调用共享同一次加载
    if (inflight) return inflight;

    status = "loading";
    emit();

    inflight = withLoadTimeout((async () => {
      const mod = api ?? (await loadModule());
      api = mod;
      // 只补缺失的 net：部分失败重试时不重复加载已就绪的那份
      await Promise.all([
        mod.nets.tinyFaceDetector.isLoaded
          ? undefined
          : mod.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URI),
        mod.nets.faceLandmark68Net.isLoaded
          ? undefined
          : mod.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URI),
      ]);
      return mod;
    })(), loadTimeoutMs)
      .then((mod) => {
        inflight = null;
        status = "ready";
        emit();
        return mod;
      })
      .catch((err) => {
        // 失败不缓存：清掉 in-flight 以便后续重试，单例不被一次网络抖动污染
        inflight = null;
        status = "failed";
        emit();
        throw err;
      });

    return inflight;
  };

  const getStatus = (): FaceModelStatus => (isReady(api) ? "ready" : status);

  return {
    load,
    getStatus,
    getApi: (): T | null => api,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const faceModels = createFaceModelStore(() => import("@vladmandic/face-api"));

/** 是否已调度过空闲预加载（防止重复调度） */
let preloadScheduled = false;

/**
 * 在主线程空闲时调度面部模型预加载（问卷选性别 / 扫脸页挂载时调用）。
 *
 * face-api/TF.js 的动态 import 会在主线程解析/编译大体积 chunk，
 * 手机上这是数百毫秒到数秒的长任务；空闲调度保证交互响应优先。
 * 幂等：已就绪/加载中不重复调度；失败后允许下次重新调度。
 */
export function scheduleFaceModelPreload(idleTimeout = 5000, fallbackDelay = 2000): void {
  if (preloadScheduled) return;
  const current = faceModels.getStatus();
  if (current === "ready" || current === "loading") return;

  preloadScheduled = true;
  runWhenIdle(() => {
    faceModels.load().catch(() => {
      // 加载失败：允许下一次调度重试
      preloadScheduled = false;
    });
  }, { timeout: idleTimeout, fallbackDelay });
}
