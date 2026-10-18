"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, ChevronDown, LogIn } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { OrbitalIcons } from "@/components/ui/OrbitalIcons";

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/admin";
  // 只允许站内 /admin 路径，防止开放重定向
  const redirectTo =
    rawRedirect.startsWith("/admin") &&
    !rawRedirect.startsWith("/admin/login") &&
    !rawRedirect.startsWith("/admin/emergency-login")
      ? rawRedirect
      : "/admin";

  const ssoError = searchParams.get("error");
  const ssoErrorText = (() => {
    switch (ssoError) {
      case "sso_forbidden":
        return "您的账号没有测肤子站访问权限，请联系主站超级管理员授予「测肤子站访问」。";
      case "sso_expired":
        return "主站登录已过期，请重新登录。";
      case "sso_state":
        return "登录状态校验失败，请重新发起登录。";
      case "sso_unreachable":
        return "主站认证服务暂时不可用，请稍后重试。";
      case "sso_conflict":
        return "账号邮箱已绑定其他主站管理员，请联系主站处理。";
      case "sso_disabled":
        return "管理员 SSO 暂未启用，请联系主站运维。";
      case "sso_not_configured":
        return "管理员 SSO 配置不完整，请联系主站运维检查环境变量。";
      case "sso_rate_limited":
        return "操作过于频繁，请稍后再试。";
      case "sso_failed":
        return "主站管理员认证失败，请重新登录。";
      default:
        return "";
    }
  })();

  const [mounted, setMounted] = useState(false);
  const [breadcrumbOpen, setBreadcrumbOpen] = useState(false);
  const breadcrumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 面包屑下拉：点击外部关闭 + Escape 关闭
  useEffect(() => {
    if (!breadcrumbOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (breadcrumbRef.current && !breadcrumbRef.current.contains(e.target as Node)) {
        setBreadcrumbOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBreadcrumbOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [breadcrumbOpen]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-cream px-6">
      {/* 面包屑导航 */}
      <div className="absolute left-6 top-6 z-20 flex items-center gap-2 text-xs text-slate-400 sm:left-10 sm:top-8">
        <Link href="/" className="transition-colors hover:text-slate-600">
          首页
        </Link>
        <span className="text-slate-300">/</span>
        <div className="relative" ref={breadcrumbRef}>
          <button
            onClick={() => setBreadcrumbOpen((v) => !v)}
            className="flex items-center gap-1 p-0 font-medium text-slate-600 transition-colors hover:text-slate-800 bg-transparent border-none cursor-pointer"
          >
            后台登录（AI 护肤顾问）
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                breadcrumbOpen && "rotate-180"
              )}
            />
          </button>
          {breadcrumbOpen && (
            <div className="absolute left-0 top-full mt-2 flex flex-col gap-2 whitespace-nowrap text-xs text-slate-400 -translate-x-[13px]">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 select-none">/</span>
                <span className="font-medium text-slate-400">管理后台登录</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 装饰背景光晕 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-brand-gold/10 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-gold/10 blur-[100px]" />
      </div>

      <div className="relative z-10 flex w-full flex-col items-center">
        {/* 轨道动画 + 登录卡片 */}
        <div
          className={cn(
            "transition-all duration-700",
            mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
        >
          <OrbitalIcons className="min-h-[620px] min-w-[380px] sm:min-h-[860px] sm:min-w-[860px]">
            <div className="w-[260px] overflow-hidden rounded-[28px] bg-transparent sm:w-[380px]">
              {/* Header */}
              <div className="px-8 pb-5 pt-10 text-center sm:px-10 sm:pb-6 sm:pt-12">
                <div className="relative mx-auto mb-4 h-[34px] w-[140px] sm:mb-5 sm:w-[160px]">
                  <Image
                    src="/NIHPLOD-logo.svg"
                    alt="NIHPLOD"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="h-1" />
              </div>

              {/* 登录区域 */}
              <div className="px-8 pb-10 sm:px-10">
                {ssoErrorText && (
                  <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                    <span>{ssoErrorText}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (redirectTo !== "/admin") params.set("return_to", redirectTo);
                    const query = params.toString();
                    window.location.href =
                      "/api/admin/auth/sso/start" + (query ? `?${query}` : "");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#8B7355]/30 bg-[#8B7355] py-3.5 text-[13px] font-bold tracking-wider text-white shadow-sm transition-all duration-300 hover:bg-[#6D5A3F]"
                >
                  <LogIn className="h-4 w-4" />
                  使用 NIHPLOD 管理员账号登录
                </button>

                <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
                  管理员账号、密码与二次验证统一由主站管理
                </p>
              </div>
            </div>
          </OrbitalIcons>
        </div>
      </div>

      {/* 页脚 */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-1 px-6">
        <p className="text-[10px] font-light tracking-widest text-brand-charcoal/40">
          &copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
        </p>
        <div className="flex items-center justify-center gap-2 text-[9px] font-light tracking-normal text-brand-charcoal/40 whitespace-nowrap">
          <Link
            href="https://beian.miit.gov.cn/"
            target="_blank" rel="noopener noreferrer"
            className="hover:text-brand-gold transition-colors"
          >
            沪ICP备2026014764号-1
          </Link>
          <span className="text-brand-charcoal/20">|</span>
          <Link
            href="http://www.beian.gov.cn/portal/registerSystemInfo"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-brand-gold transition-colors"
          >
            <Image
              src="/images/beian.webp"
              alt="备案图标"
              width={12}
              height={12}
              className="shrink-0 opacity-60"
            />
            <span>沪公网安备31010702010178号</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-brand-cream">
          <Loader2 className="h-8 w-8 animate-spin text-[#8B7355]" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
