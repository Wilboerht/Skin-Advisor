"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// 官网（SSO 主站）origin：本地 http 开发兼容，未配置时等于线上主站
const SSO_BASE_URL = (process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn").replace(/\/+$/, "");

// iframe 高度上限：超出部分由嵌入页内部滚动
const MAX_HEIGHT_VH = 70;
const DEFAULT_HEIGHT = 420;

interface AccountMallTabProps {
  onClose: () => void;
}

/**
 * 「积分商城」tab：嵌入官网 /account/embed?tab=mall。
 * - 由 AccountModal 在 tab 首次激活时才挂载（不随弹层打开即加载）；
 * - 嵌入页 postMessage NIHPLOD_SSO_RESIZE 自适应高度（校验 origin，上限 70vh）；
 * - NIHPLOD_SSO_LOGOUT / NIHPLOD_SSO_REVOKE：主站会话已清，本站本地态由
 *   UserProvider 的会话终结链路处理，这里仅关闭弹层。
 */
export function AccountMallTab({ onClose }: AccountMallTabProps) {
  const [loaded, setLoaded] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const heightRef = useRef(DEFAULT_HEIGHT);

  const ssoOrigin = useMemo(() => {
    try {
      return new URL(SSO_BASE_URL).origin;
    } catch {
      return SSO_BASE_URL;
    }
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== ssoOrigin) return;
      const data = e.data as { type?: string; height?: unknown } | null;
      if (!data || typeof data.type !== "string") return;
      if (data.type === "NIHPLOD_SSO_RESIZE" && typeof data.height === "number" && data.height > 0) {
        const max = Math.round(window.innerHeight * (MAX_HEIGHT_VH / 100));
        const next = Math.min(Math.round(data.height), max);
        if (next !== heightRef.current) {
          heightRef.current = next;
          setHeight(next);
        }
      } else if (data.type === "NIHPLOD_SSO_LOGOUT" || data.type === "NIHPLOD_SSO_REVOKE") {
        onClose();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [ssoOrigin, onClose]);

  return (
    <div className="relative w-full" style={{ height }}>
      {/* 骨架屏：iframe 首屏加载完成前覆盖 */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse" aria-busy="true" aria-label="积分商城加载中">
          <div className="h-10 rounded-xl bg-brand-charcoal/[0.06] mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-brand-charcoal/[0.04]" />
            ))}
          </div>
        </div>
      )}
      <iframe
        src={`${SSO_BASE_URL}/account/embed?tab=mall`}
        title="积分商城"
        onLoad={() => setLoaded(true)}
        // 纵深防御：限制嵌入页能力（同源+脚本为商城交互必需，表单用于兑换提交，
        // 弹窗用于商城内"去官网"类链接；不允许顶层导航/弹模态）
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        className={`w-full h-full rounded-2xl border border-brand-charcoal/[0.08] bg-white transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
