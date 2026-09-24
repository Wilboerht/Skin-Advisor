"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { ExternalLink, RefreshCw, X } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useLegalDocModal, type LegalDoc } from "@/components/website/LegalDocModalContext";

// 主站 origin：与用户面板 BFF 同口径，本地/预发可随环境变量切换
const SSO_BASE_URL = (process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn").replace(/\/+$/, "");

const DOC_META: Record<LegalDoc, { title: string; embedPath: string; pagePath: string }> = {
  privacy: { title: "隐私政策", embedPath: "/privacy/embed", pagePath: "/privacy" },
  terms: { title: "服务条款", embedPath: "/terms/embed", pagePath: "/terms" },
};

/**
 * LegalDocModal — 隐私政策/服务条款阅读弹层
 * iframe 嵌入主站 /privacy|/terms/embed（无头尾版，主站按路由白名单放行 frame-ancestors；
 * 主站 embed 路由未部署或被拦截时 15s 超时降级，可重试或新窗口打开正式页）。
 * z 层级（100110）高于 OnboardingFlowModal（100002）与全站模态层（--z-modal 100100）；
 * Escape/焦点圈定走 useFocusTrap 的嵌套栈，只关最上层，不连带关闭下层弹窗。
 */
export function LegalDocModal() {
  const { doc, closeLegalDoc } = useLegalDocModal();
  const isOpen = doc !== null;

  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // 重试时自增：作为 iframe key 强制重挂载，超时计时器同步重置
  const [attempt, setAttempt] = useState(0);

  useBodyScrollLock({ enabled: isOpen, iosSafe: true });
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, closeLegalDoc);

  // 切换文档/关闭重开时重置加载态
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [doc, attempt]);

  // 加载超时兜底：15s 内未触发 onLoad 则进入失败态
  useEffect(() => {
    if (!isOpen || loaded || failed) return;
    const timer = window.setTimeout(() => setFailed(true), 15000);
    return () => window.clearTimeout(timer);
  }, [isOpen, loaded, failed, attempt]);

  const meta = doc ? DOC_META[doc] : null;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && meta && (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-doc-modal-title"
            tabIndex={-1}
            className="fixed inset-0 z-[100110] flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            {/* 背景遮罩 */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeLegalDoc}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            {/* 弹窗主体：移动端底部升起，桌面端居中（规格与全站模态框一致） */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full h-[85dvh] sm:h-[min(680px,calc(100dvh-3rem))] sm:max-w-[760px] bg-[#F7F4EE] rounded-t-[28px] sm:rounded-[2.5rem] shadow-[0_45px_80px_-16px_rgba(61,47,37,0.18)] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 顶栏：标题 + 新窗口打开正式页 + 关闭 */}
              <div className="shrink-0 flex items-center justify-between pl-6 md:pl-8 pr-3 sm:pr-5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] sm:pt-4 pb-3 border-b border-brand-charcoal/[0.06]">
                <h2
                  id="legal-doc-modal-title"
                  className="text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em]"
                >
                  {meta.title}
                </h2>
                <div className="flex items-center gap-1">
                  <a
                    href={`${SSO_BASE_URL}${meta.pagePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="在新窗口打开"
                    className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.06] transition-colors"
                  >
                    <ExternalLink size={15} strokeWidth={1.75} />
                  </a>
                  <button
                    onClick={closeLegalDoc}
                    aria-label="关闭"
                    className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-brand-charcoal/55 hover:text-brand-charcoal hover:bg-brand-charcoal/[0.06] transition-colors cursor-pointer"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* 内容区：iframe 内嵌主站 embed 页，文档在 iframe 内滚动 */}
              <div className="flex-1 min-h-0 relative bg-white">
                {!loaded && !failed && (
                  <div className="absolute inset-0 animate-pulse p-6 md:p-8" aria-busy="true" aria-label={`${meta.title}加载中`}>
                    <div className="h-6 w-40 rounded-lg bg-brand-charcoal/[0.06] mb-6" />
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="mb-5">
                        <div className="h-4 w-32 rounded bg-brand-charcoal/[0.05] mb-2.5" />
                        <div className="h-3 w-full rounded bg-brand-charcoal/[0.04] mb-1.5" />
                        <div className="h-3 w-11/12 rounded bg-brand-charcoal/[0.04]" />
                      </div>
                    ))}
                  </div>
                )}
                {failed ? (
                  <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center px-6">
                    <p className="text-[13px] text-brand-charcoal/60 mb-4 text-center">
                      {meta.title}加载失败，请检查网络后重试
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setAttempt((n) => n + 1)}
                        className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-brand-charcoal border border-brand-charcoal/20 hover:bg-brand-charcoal/[0.04] transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        重试
                      </button>
                      <a
                        href={`${SSO_BASE_URL}${meta.pagePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-brand-charcoal/60 hover:text-brand-charcoal transition-colors"
                      >
                        新窗口打开
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <iframe
                    key={`${doc}-${attempt}`}
                    src={`${SSO_BASE_URL}${meta.embedPath}`}
                    title={meta.title}
                    onLoad={() => setLoaded(true)}
                    // 静态文档页：同源 + 脚本足够（正文为主站 SSR 内容）；不允许表单/弹窗/顶层导航
                    sandbox="allow-scripts allow-same-origin"
                    className={`w-full h-full transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
                  />
                )}
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
