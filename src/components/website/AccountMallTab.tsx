"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

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
 * - 嵌入页 postMessage NIHPLOD_SSO_RESIZE 自适应高度（校验 origin）；
 *   高度按「70vh」与「弹层内容区实测可用高度」双重收紧，避免 iframe 高于可视区导致嵌套滚动；
 * - 加载超时（15s）显示失败态并可重试，避免骨架永久闪烁；
 * - NIHPLOD_SSO_LOGOUT / NIHPLOD_SSO_REVOKE：主站会话已清，本站本地态由
 *   UserProvider 的会话终结链路处理，这里仅关闭弹层。
 */
export function AccountMallTab({ onClose }: AccountMallTabProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // 重试时自增：作为 iframe key 强制重挂载，超时计时器同步重置
  const [attempt, setAttempt] = useState(0);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const heightRef = useRef(DEFAULT_HEIGHT);
  // 弹层内容区实测可用高度（account-scroll 容器），postMessage 报高按它收紧
  const availableRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 测量可用高度：跟随弹层/窗口尺寸变化；容器收缩时同步收缩 iframe
  useEffect(() => {
    const scrollParent = wrapperRef.current?.closest<HTMLElement>("[data-account-scroll]");
    if (!scrollParent) return;
    const apply = () => {
      const available = Math.max(320, scrollParent.clientHeight - 80);
      availableRef.current = available;
      if (heightRef.current > available) {
        heightRef.current = available;
        setHeight(available);
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(scrollParent);
    return () => ro.disconnect();
  }, []);

  // 加载超时兜底：15s 内未触发 onLoad 则进入失败态
  useEffect(() => {
    if (loaded || failed) return;
    const timer = window.setTimeout(() => setFailed(true), 15000);
    return () => window.clearTimeout(timer);
  }, [loaded, failed, attempt]);

  const retry = () => {
    setLoaded(false);
    setFailed(false);
    setAttempt((n) => n + 1);
  };

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
        const maxVh = Math.round(window.innerHeight * (MAX_HEIGHT_VH / 100));
        const cap = Math.min(maxVh, availableRef.current ?? maxVh);
        const next = Math.min(Math.round(data.height), cap);
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
    <div ref={wrapperRef} className="relative w-full" style={{ height }}>
      {/* 骨架屏：iframe 首屏加载完成前覆盖 */}
      {!loaded && !failed && (
        <div className="absolute inset-0 animate-pulse" aria-busy="true" aria-label="积分商城加载中">
          <div className="h-10 rounded-xl bg-brand-charcoal/[0.06] mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-brand-charcoal/[0.04]" />
            ))}
          </div>
        </div>
      )}
      {failed ? (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-brand-charcoal/[0.08] bg-white/60"
        >
          <p className="text-[13px] text-brand-charcoal/60 mb-4">积分商城加载失败，请检查网络后重试</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-brand-charcoal border border-brand-charcoal/20 hover:bg-brand-charcoal/[0.04] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重试
          </button>
        </div>
      ) : (
        <iframe
          key={attempt}
          src={`${SSO_BASE_URL}/account/embed?tab=mall`}
          title="积分商城"
          onLoad={() => setLoaded(true)}
          // 纵深防御：限制嵌入页能力（同源+脚本为商城交互必需，表单用于兑换提交，
          // 弹窗用于商城内"去官网"类链接；不允许顶层导航/弹模态）
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          className={`w-full h-full rounded-2xl border border-brand-charcoal/[0.08] bg-white transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
