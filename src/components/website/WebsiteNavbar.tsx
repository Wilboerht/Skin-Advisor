"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { User, ExternalLink, Menu, X } from "lucide-react";
import { HomeSvg } from "@/components/icons/HomeSvg";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useUser } from "@/components/auth/UserProvider";

const navItems = [
  { label: "素颜测肤", href: "/" },
  { label: "肌肤性格", href: "/skin-types" },
  { label: "更多服务", href: "/services" },
];

interface WebsiteNavbarProps {
  variant?: "light" | "dark";
}

export function WebsiteNavbar({ variant = "light" }: WebsiteNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { openAuthModal } = useAuthModal();
  const { user, isVip } = useUser();
  const pathname = usePathname();
  const isDark = variant === "dark" && !scrolled;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 打开移动端菜单时禁止背景滚动
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const handleLoginClick = () => {
    setMobileMenuOpen(false);
    openAuthModal("login");
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-12 lg:px-20 py-5 md:py-7 transition-all duration-500 ${
          scrolled
            ? "bg-[#F8F7F3]/80 backdrop-blur-md border-b border-[rgba(61,68,48,0.06)]"
            : isDark
              ? "bg-transparent border-b border-transparent"
              : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="w-full grid grid-cols-[auto_1fr] md:grid-cols-[1fr_auto_1fr] items-center">
          <Link href="/" className="cursor-pointer justify-self-start">
            <Image
              src="/NIHPLOD-logo.svg"
              alt="NIHPLOD"
              width={120}
              height={36}
              className={`h-8 md:h-9 w-auto object-contain transition-opacity duration-500 ${
                isDark ? "invert opacity-90 hover:opacity-100" : "opacity-80 hover:opacity-100"
              }`}
            />
          </Link>

          {/* 中间导航 - 桌面端 */}
          <div className="hidden md:flex items-center justify-center gap-8 lg:gap-10">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group relative text-[15px] font-medium tracking-[0.2em] transition-colors duration-500 ${
                    isActive
                      ? isDark ? "text-white" : "text-[#3D4430]"
                      : isDark
                        ? "text-white/70 hover:text-white"
                        : "text-[#3D4430]/70 hover:text-[#3D4430]"
                  }`}
                >
                  {item.label}
                  {!isActive && (
                    <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
                  )}
                </Link>
              );
            })}
            <a
              href="https://nihplod.cn/about"
              target="_blank"
              rel="noopener noreferrer"
              className={`group relative flex items-center gap-1.5 text-[15px] font-medium tracking-[0.2em] transition-colors duration-500 ${
                isDark
                  ? "text-white/70 hover:text-white"
                  : "text-[#3D4430]/70 hover:text-[#3D4430]"
              }`}
            >
              探索旎柏
              <ExternalLink className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
            </a>
          </div>

          <div className="flex items-center justify-end gap-3 md:gap-7">
            {/* 桌面端：已登录显示用户入口，未登录显示登录按钮 */}
            {user ? (
              <Link
                href="/profile"
                className={`group hidden md:flex items-center gap-2 text-[15px] font-medium tracking-[0.2em] transition-colors duration-500 cursor-pointer ${
                  isDark
                    ? "text-white/70 hover:text-white"
                    : "text-[#3D4430]/70 hover:text-[#3D4430]"
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-[#3D4430]/10 flex items-center justify-center text-[#3D4430] text-xs font-serif shrink-0">
                  {(user.name || user.email || user.phone || "U").charAt(0).toUpperCase()}
                </div>
                <span className="hidden lg:inline relative max-w-[120px] truncate">
                  {user.name || user.email || user.phone || "用户"}
                  {isVip && (
                    <span className="ml-2 text-[10px] tracking-wider px-1.5 py-0.5 rounded-full bg-[#3D4430] text-[#F8F7F3] font-medium align-middle">
                      VIP
                    </span>
                  )}
                  <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
                </span>
              </Link>
            ) : (
              <button
                onClick={() => openAuthModal("login")}
                className={`group hidden md:flex items-center gap-2 text-[15px] font-medium tracking-[0.2em] transition-colors duration-500 cursor-pointer ${
                  isDark
                    ? "text-white/70 hover:text-white"
                    : "text-[#3D4430]/70 hover:text-[#3D4430]"
                }`}
              >
                <User className="w-5 h-5 sm:w-[1.125rem] sm:h-[1.125rem] transition-opacity duration-500" />
                <span className="hidden sm:inline relative">
                  登录
                  <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
                </span>
              </button>
            )}

            {/* 移动端用户图标：已登录跳转个人中心，未登录打开登录面板 */}
            {user ? (
              <Link
                href="/profile"
                aria-label="个人中心"
                className={`md:hidden group flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-500 ${
                  isDark
                    ? "text-white/70 hover:text-white hover:bg-white/10"
                    : "text-[#3D4430]/70 hover:text-[#3D4430] hover:bg-[#3D4430]/5"
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-[#3D4430]/10 flex items-center justify-center text-[#3D4430] text-xs font-serif">
                  {(user.name || user.email || user.phone || "U").charAt(0).toUpperCase()}
                </div>
              </Link>
            ) : (
              <button
                onClick={() => openAuthModal("login")}
                aria-label="登录"
                className={`md:hidden group flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-500 cursor-pointer ${
                  isDark
                    ? "text-white/70 hover:text-white hover:bg-white/10"
                    : "text-[#3D4430]/70 hover:text-[#3D4430] hover:bg-[#3D4430]/5"
                }`}
              >
                <User className="w-5 h-5 transition-opacity duration-500" />
              </button>
            )}

            {/* 首页链接 */}
            {pathname !== "/" && (
              <Link
                href="/"
                className={`group hidden md:flex items-center gap-2 text-[15px] font-medium tracking-[0.2em] transition-colors duration-500 ${
                  isDark
                    ? "text-white/70 hover:text-white"
                    : "text-[#3D4430]/70 hover:text-[#3D4430]"
                }`}
              >
                <HomeSvg className="w-6 h-6 sm:w-5 sm:h-5 transition-opacity duration-500" />
                <span className="hidden sm:inline relative">
                  首页
                  <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
                </span>
              </Link>
            )}

            {/* 移动端汉堡菜单按钮 */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="打开菜单"
              aria-expanded={mobileMenuOpen}
              className={`md:hidden group flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-500 cursor-pointer ${
                isDark
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : "text-[#3D4430]/70 hover:text-[#3D4430] hover:bg-[#3D4430]/5"
              }`}
            >
              <Menu className="w-5 h-5 transition-opacity duration-500" />
            </button>
          </div>
        </div>
      </nav>

      {/* 移动端全屏菜单 */}
      <div
        className={`fixed inset-0 z-[60] md:hidden transition-all duration-500 ${
          mobileMenuOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        {/* 背景遮罩 */}
        <div
          className="absolute inset-0 bg-[#1A1A1A]/20 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* 菜单面板 */}
        <div
          className={`absolute top-0 right-0 h-full w-[min(320px,85vw)] bg-[#F8F7F3] shadow-2xl transform transition-transform duration-500 ease-out ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full px-6 py-5">
            {/* 顶部关闭按钮 */}
            <div className="flex items-center justify-end mb-6">
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="关闭菜单"
                className="group flex items-center justify-center w-10 h-10 rounded-full text-[#3D4430]/70 hover:text-[#3D4430] hover:bg-[#3D4430]/5 transition-colors duration-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 用户信息 / 登录入口 */}
            <div className="mb-8 px-4">
              {user ? (
                <Link
                  href="/profile"
                  onClick={handleNavClick}
                  className="flex items-center gap-4 group"
                >
                  <div className="w-14 h-14 rounded-full bg-[#3D4430]/10 flex items-center justify-center text-[#3D4430] shrink-0">
                    <span className="text-lg font-serif">
                      {(user.name || user.email || user.phone || "U").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-[#1A1A1A] truncate">
                      {user.name || user.email || user.phone || "用户"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {isVip && (
                        <span className="text-[11px] tracking-wider px-2 py-0.5 rounded-full bg-[#3D4430] text-[#F8F7F3] font-medium">
                          VIP
                        </span>
                      )}
                      <span className="text-[13px] text-[#5E5E5E]/70">
                        查看个人中心
                      </span>
                    </div>
                  </div>
                </Link>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="w-full flex items-center gap-4 group cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-full bg-[#3D4430]/8 flex items-center justify-center text-[#3D4430]/50 shrink-0 group-hover:bg-[#3D4430]/12 transition-colors duration-300">
                    <User className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[15px] font-medium text-[#1A1A1A]">
                      未登录
                    </p>
                    <p className="text-[13px] text-[#5E5E5E]/70 mt-0.5">
                      点击登录或注册
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-[#3D4430]/30 group-hover:text-[#3D4430]/50 transition-colors duration-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              )}
            </div>

            {/* 导航链接 */}
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={handleNavClick}
                    className={`group relative px-4 py-4 text-[15px] font-medium tracking-[0.2em] rounded-xl transition-all duration-300 ${
                      isActive
                        ? "text-[#3D4430] bg-[#3D4430]/8"
                        : "text-[#3D4430]/70 hover:text-[#3D4430] hover:bg-[#3D4430]/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <a
                href="https://nihplod.cn/about"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleNavClick}
                className="group flex items-center gap-2 px-4 py-4 text-[15px] font-medium tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] hover:bg-[#3D4430]/5 rounded-xl transition-all duration-300"
              >
                探索旎柏
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </nav>

            <div className="mt-auto pt-8">
              {pathname !== "/" && (
                <Link
                  href="/"
                  onClick={handleNavClick}
                  className="group flex items-center gap-3 px-4 py-4 text-[15px] font-medium tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] hover:bg-[#3D4430]/5 rounded-xl transition-all duration-300"
                >
                  <HomeSvg className="w-5 h-5" />
                  首页
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
