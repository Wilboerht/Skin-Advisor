"use client";

import { useSyncExternalStore } from "react";
import { faceModels } from "@/lib/face-models";

/**
 * useFaceModels — 订阅全局面部模型状态（唯一事实源）
 *
 * status: idle → loading → ready | failed（失败可重试，见 face-models.ts）
 * load:   幂等触发加载；可用于失败后的"重试自动检测"
 */
export function useFaceModels() {
  const status = useSyncExternalStore(
    faceModels.subscribe,
    faceModels.getStatus,
    () => "idle" as const
  );
  return { status, load: faceModels.load };
}
