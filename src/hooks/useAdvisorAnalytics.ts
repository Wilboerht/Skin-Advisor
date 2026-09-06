/**
 * AI 顾问行为分析 Hook
 * 
 * 提供统一的事件追踪接口，用于收集用户行为数据
 */

"use client";

import { useCallback, useRef } from "react";

// 事件类型
type AnalyticsEvent =
  | "session_start"
  | "questionnaire_start"
  | "questionnaire_complete"
  | "face_scan_start"
  | "face_scan_complete"
  | "face_scan_step"
  | "analysis_start"
  | "analysis_complete"
  | "result_view"
  | "result_share"
  | "product_click";

// 会话ID存储键
const SESSION_ID_KEY = "advisor_session_id";

/**
 * 生成唯一会话ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomStr}`;
}

/**
 * 获取或创建会话ID
 */
function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";

  // 无痕模式 / 禁用存储时 sessionStorage 访问会抛异常，降级为不上报
  try {
    let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    return sessionId;
  } catch {
    return "";
  }
}

/**
 * 获取UTM参数
 */
function getUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
  };
}

/**
 * 获取客户端基础环境信息（非唯一标识，仅用于统计分析）
 * 不包含 Canvas 指纹等敏感追踪技术
 */
function getClientEnv(): Record<string, string | number> {
  if (typeof window === "undefined") return {};
  return {
    language: navigator.language,
    timezone: new Date().getTimezoneOffset(),
  };
}

/**
 * 发送追踪事件
 */
async function sendTrackEvent(
  event: AnalyticsEvent,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    // sessionStorage 可能不可用（无痕模式），在 try 内获取，失败则静默跳过
    const sessionId = getOrCreateSessionId();
    if (!sessionId) return;

    // 使用 sendBeacon 确保页面关闭时也能发送
    const payload = JSON.stringify({
      sessionId,
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    // 优先使用 sendBeacon，fallback 到 fetch
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/advisor/analytics/track",
        new Blob([payload], { type: "application/json" })
      );
    } else {
      await fetch("/api/advisor/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch (error) {
    // 静默失败，不影响用户体验
    console.debug("Analytics track failed:", error);
  }
}

/**
 * AI 顾问分析 Hook
 */
export function useAdvisorAnalytics() {
  const initialized = useRef(false);

  // 初始化会话
  const initSession = useCallback(() => {
    if (initialized.current) return;
    initialized.current = true;

    const clientEnv = getClientEnv();
    const utmParams = getUtmParams();

    // 读取 ref 来源归因（由首页 page.tsx 从 ?ref=xxx 写入 sessionStorage）
    let refSource = "";
    if (typeof window !== "undefined") {
      try { refSource = sessionStorage.getItem("advisor_ref_source") || ""; } catch { /* sessionStorage unavailable */ }
    }

    sendTrackEvent("session_start", {
      ...clientEnv,
      ...utmParams,
      ref_source: refSource,
    });
  }, []);

  // 追踪问卷开始
  const trackQuestionnaireStart = useCallback(() => {
    sendTrackEvent("questionnaire_start");
  }, []);

  // 追踪问卷完成
  const trackQuestionnaireComplete = useCallback((answers: Record<string, unknown>) => {
    // 只上报问卷字段数量，不上报具体答案内容，保护用户隐私
    const fieldCount = Object.keys(answers).length;
    sendTrackEvent("questionnaire_complete", { fieldCount });
  }, []);

  // 追踪面部扫描开始
  const trackFaceScanStart = useCallback(() => {
    sendTrackEvent("face_scan_start");
  }, []);

  // 追踪面部扫描完成
  const trackFaceScanComplete = useCallback(() => {
    sendTrackEvent("face_scan_complete");
  }, []);

  // 追踪面部扫描单步完成（用于漏斗分析：正脸/右转/左转/抬头各步完成率与卡点）
  const trackFaceScanStep = useCallback((step: string, mode: "auto" | "manual" = "auto") => {
    sendTrackEvent("face_scan_step", { step, mode });
  }, []);

  // 追踪分析开始
  const trackAnalysisStart = useCallback(() => {
    sendTrackEvent("analysis_start");
  }, []);

  // 追踪分析完成
  const trackAnalysisComplete = useCallback((source: "ai" | "fallback") => {
    sendTrackEvent("analysis_complete", { source });
  }, []);

  // 追踪结果查看
  const trackResultView = useCallback(() => {
    sendTrackEvent("result_view");
  }, []);

  // 追踪结果分享
  const trackResultShare = useCallback((method: "image" | "link" | "weibo" | "native" | "wechat" | "xiaohongshu" | "douyin") => {
    sendTrackEvent("result_share", { method });
  }, []);

  // 获取当前会话ID
  const getSessionId = useCallback(() => {
    return getOrCreateSessionId();
  }, []);

  // 追踪产品点击
  const trackProductClick = useCallback((productId: string, productName: string) => {
    sendTrackEvent("product_click", { productId, productName });
  }, []);

  return {
    initSession,
    trackQuestionnaireStart,
    trackQuestionnaireComplete,
    trackFaceScanStart,
    trackFaceScanComplete,
    trackFaceScanStep,
    trackAnalysisStart,
    trackAnalysisComplete,
    trackResultView,
    trackResultShare,
    trackProductClick,
    getSessionId,
  };
}


