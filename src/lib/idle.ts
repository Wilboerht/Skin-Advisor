"use client";

/**
 * 空闲调度工具：把非紧急的重活（大体积 chunk 的解析编译、指纹计算、模型初始化等）
 * 推迟到主线程空闲时执行，保证交互响应（点击返回/退出等）优先于后台加载。
 *
 * Safari 不支持 requestIdleCallback，退化为延迟 setTimeout。
 * timeout / fallbackDelay 控制最晚启动时间，避免任务被无限推迟。
 */

interface IdleOptions {
    /** requestIdleCallback 的最长等待时间（ms），超时强制执行 */
    timeout?: number;
    /** 无 requestIdleCallback 时的 setTimeout 延迟（ms） */
    fallbackDelay?: number;
}

/** 调度 cb 在空闲时执行；返回取消函数（组件卸载时可用于阻止未启动的任务） */
export function runWhenIdle(cb: () => void, { timeout = 5000, fallbackDelay = 2000 }: IdleOptions = {}): () => void {
    if (typeof window === "undefined") return () => { /* SSR 不调度 */ };

    if ("requestIdleCallback" in window && typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(cb, { timeout });
        return () => window.cancelIdleCallback(handle);
    }

    const timer = setTimeout(cb, fallbackDelay);
    return () => clearTimeout(timer);
}
