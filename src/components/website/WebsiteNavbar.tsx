"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { User, ExternalLink, Menu } from "lucide-react";
import { HomeSvg } from "@/components/icons/HomeSvg";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useUser } from "@/components/auth/UserProvider";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  image?: string;
}

const navItems: NavItem[] = [
  { label: "素颜测肤", href: "/" },
  { label: "测肤有礼", href: "/gift" },
  { label: "了解肌智派", href: "/skin-types" },
  { label: "顾问服务", href: "/services" },
];

interface WebsiteNavbarProps {
  variant?: "light" | "dark";
}

const MOBILE_MENU_ID = "mobile-nav-menu";

export function WebsiteNavbar({ variant = "light" }: WebsiteNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { openAuthModal } = useAuthModal();
  const { user } = useUser();
  const pathname = usePathname();
  const isDark = variant === "dark" && !scrolled;
  const mobileMenuRef = useFocusTrap<HTMLDivElement>(mobileMenuOpen);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 打开移动端菜单时禁止背景滚动（iOS 兼容：使用 position:fixed 防止页面跳到顶部）
  useEffect(() => {
    if (mobileMenuOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        window.scrollTo(0, scrollY);
      };
    }
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
        style={{ pointerEvents: "none" }}
        className={`fixed top-0 left-0 right-0 z-[100000] px-6 md:px-12 lg:px-20 py-7 transition-all duration-500 ${
          scrolled
            ? "bg-[#FDFBF7]/80 backdrop-blur-md border-b border-[rgba(61,68,48,0.06)]"
            : isDark
              ? "bg-transparent border-b border-transparent"
              : "bg-transparent border-b border-transparent"
        }`}
      >
        <div style={{ pointerEvents: "auto" }} className="w-full flex items-center justify-center md:justify-between relative">
          {/* Logo：移动端居中，桌面端靠左 */}
          <Link href="/" className="cursor-pointer shrink-0">
            <Image
              src="/NIHPLOD-logo.svg"
              alt="NIHPLOD"
              width={120}
              height={36}
              className={`h-7 md:h-9 w-auto object-contain transition-opacity duration-500 ${
                isDark ? "invert opacity-90 hover:opacity-100" : "opacity-80 hover:opacity-100"
              }`}
            />
          </Link>

          {/* 中间导航 - 桌面端 */}
          <div className="hidden md:flex items-center justify-center gap-8 lg:gap-10 absolute left-1/2 -translate-x-1/2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group relative py-2 px-1 -mx-1 rounded-md ${(item.icon || item.badge || item.image) ? "flex items-center gap-1.5" : ""} text-[15px] font-light tracking-[0.15em] transition-colors duration-500 focus-visible:outline-none ${
                    isActive
                      ? isDark ? "text-white" : "text-[#00263E]"
                      : isDark
                        ? `text-white/70 hover:text-white focus-visible:text-white ${scrolled ? "hover:bg-white/[0.06]" : ""}`
                        : `text-[#00263E] hover:text-[#4A6272] focus-visible:text-[#4A6272] ${scrolled ? "hover:bg-[#00263E]/[0.03]" : ""}`
                  }`}
                >
                  {item.image && (
                    <Image
                      src={item.image}
                      alt=""
                      width={36}
                      height={36}
                      className="w-6 h-6 md:w-7 md:h-7 object-contain drop-shadow-[0_1px_0_rgba(0,38,62,0.28)] animate-[soft-blink_3s_ease-in-out_infinite]"
                    />
                  )}
                  {item.label}
                  {item.badge && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wider rounded bg-[#C8A27A]/15 text-[#A0784C] border border-[#C8A27A]/30">
                      {item.badge}
                    </span>
                  )}
                  {item.icon && (
                    <item.icon className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  )}
                  {isActive ? (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 scale-y-50 h-[1px] w-[calc(100%-1.5rem)] bg-current opacity-40" />
                  ) : (
                    <span className="absolute bottom-0 left-1/2 h-[1px] w-0 -translate-x-1/2 scale-y-50 bg-current opacity-40 transition-[width] duration-500 ease-out group-hover:w-[calc(100%-1.5rem)] group-focus-visible:w-[calc(100%-1.5rem)]" />
                  )}
                </Link>
              );
            })}
            <a
              href="https://nihplod.cn/about"
              target="_blank"
              rel="noopener noreferrer"
              className={`group relative flex items-center gap-1.5 py-2 px-1 -mx-1 rounded-md text-[15px] font-light tracking-[0.15em] transition-colors duration-500 focus-visible:outline-none ${
                isDark
                  ? `text-white/70 hover:text-white focus-visible:text-white ${scrolled ? "hover:bg-white/[0.06]" : ""}`
                  : `text-[#00263E] hover:text-[#4A6272] focus-visible:text-[#4A6272] ${scrolled ? "hover:bg-[#00263E]/[0.03]" : ""}`
              }`}
            >
              探索旎柏
              <ExternalLink className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              <span className="absolute bottom-0 left-1/2 h-[1px] w-0 -translate-x-1/2 scale-y-50 bg-current opacity-40 transition-[width] duration-500 ease-out group-hover:w-[calc(100%-1.5rem)] group-focus-visible:w-[calc(100%-1.5rem)]" />
            </a>
          </div>

          {/* 右侧操作区 - 桌面端 */}
          <div className="hidden md:flex items-center gap-7 shrink-0">
            {user ? (
              <Link
                href="/profile"
                className={`group relative flex items-center gap-2 py-2 px-1 -mx-1 rounded-md text-[15px] font-light tracking-[0.15em] transition-colors duration-500 cursor-pointer focus-visible:outline-none ${
                  isDark
                    ? `text-white/70 hover:text-white focus-visible:text-white ${scrolled ? "hover:bg-white/[0.06]" : ""}`
                    : `text-[#00263E] hover:text-[#4A6272] focus-visible:text-[#4A6272] ${scrolled ? "hover:bg-[#00263E]/[0.03]" : ""}`
                }`}
              >
                <div className="relative w-7 h-7 rounded-full overflow-hidden bg-[#00263E]/10 flex items-center justify-center text-[#00263E] text-xs font-serif shrink-0">
                  {user.avatar ? (
                    <Image src={user.avatar} alt="" fill unoptimized className="object-cover" />
                  ) : (
                    (user.name || user.email || user.phone || "U").charAt(0).toUpperCase()
                  )}
                </div>
                <span className="hidden lg:inline max-w-[120px] truncate">
                  {user.name || user.email || user.phone || "用户"}
                </span>
                <span className="absolute bottom-0 left-1/2 h-[1px] w-0 -translate-x-1/2 scale-y-50 bg-current opacity-40 transition-[width] duration-500 ease-out group-hover:w-[calc(100%-1.5rem)] group-focus-visible:w-[calc(100%-1.5rem)]" />
              </Link>
            ) : (
              <button
                onClick={() => openAuthModal("login")}
                className={`group relative flex items-center gap-2 py-2 px-1 -mx-1 rounded-md text-[15px] font-light tracking-[0.15em] transition-colors duration-500 cursor-pointer focus-visible:outline-none ${
                  isDark
                    ? `text-white/70 hover:text-white focus-visible:text-white ${scrolled ? "hover:bg-white/[0.06]" : ""}`
                    : `text-[#00263E] hover:text-[#4A6272] focus-visible:text-[#4A6272] ${scrolled ? "hover:bg-[#00263E]/[0.03]" : ""}`
                }`}
              >
                <User className="w-5 h-5 sm:w-[1.125rem] sm:h-[1.125rem] transition-opacity duration-500" />
                <span className="hidden sm:inline">
                  登录
                </span>
                <span className="absolute bottom-0 left-1/2 h-[1px] w-0 -translate-x-1/2 scale-y-50 bg-current opacity-40 transition-[width] duration-500 ease-out group-hover:w-[calc(100%-1.5rem)] group-focus-visible:w-[calc(100%-1.5rem)]" />
              </button>
            )}
            {pathname !== "/" && (
              <Link
                href="/"
                className={`group relative flex items-center gap-2 py-2 px-1 -mx-1 rounded-md text-[15px] font-light tracking-[0.15em] transition-colors duration-500 focus-visible:outline-none ${
                  isDark
                    ? `text-white/70 hover:text-white focus-visible:text-white ${scrolled ? "hover:bg-white/[0.06]" : ""}`
                    : `text-[#00263E] hover:text-[#4A6272] focus-visible:text-[#4A6272] ${scrolled ? "hover:bg-[#00263E]/[0.03]" : ""}`
                }`}
              >
                <HomeSvg className="w-6 h-6 sm:w-5 sm:h-5 transition-opacity duration-500" />
                <span className="hidden sm:inline">
                  首页
                </span>
                <span className="absolute bottom-0 left-1/2 h-[1px] w-0 -translate-x-1/2 scale-y-50 bg-current opacity-40 transition-[width] duration-500 ease-out group-hover:w-[calc(100%-1.5rem)] group-focus-visible:w-[calc(100%-1.5rem)]" />
              </Link>
            )}
          </div>

          {/* 移动端汉堡菜单按钮：绝对定位左侧 */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="打开菜单"
            aria-expanded={mobileMenuOpen}
            aria-controls={MOBILE_MENU_ID}
            className={`md:hidden absolute left-0 flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-500 cursor-pointer ${
              isDark
                ? "text-white/70 active:text-white active:bg-white/10"
                : "text-[#00263E] active:bg-[#00263E]/5"
            }`}
          >
            <Menu className="w-5 h-5 transition-opacity duration-500" />
          </button>

          {/* 移动端用户图标：绝对定位右侧 */}
          {user ? (
            <Link
              href="/profile"
              aria-label="个人中心"
              className={`md:hidden absolute right-0 flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-500 ${
                isDark
                  ? "text-white/70 active:text-white active:bg-white/10"
                  : "text-[#00263E] active:bg-[#00263E]/5"
              }`}
            >
              <div className="relative w-7 h-7 rounded-full overflow-hidden bg-[#00263E]/10 flex items-center justify-center text-[#00263E] text-xs font-serif">
                {user.avatar ? (
                  <Image src={user.avatar} alt="" fill unoptimized className="object-cover" />
                ) : (
                  (user.name || user.email || user.phone || "U").charAt(0).toUpperCase()
                )}
              </div>
            </Link>
          ) : (
            <button
              onClick={() => openAuthModal("login")}
              aria-label="登录"
              className={`md:hidden absolute right-0 flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-500 cursor-pointer ${
                isDark
                  ? "text-white/70 active:text-white active:bg-white/10"
                  : "text-[#00263E] active:bg-[#00263E]/5"
              }`}
            >
              <User className="w-5 h-5 transition-opacity duration-500" />
            </button>
          )}
        </div>
      </nav>

      {/* 移动端全屏菜单 */}
      <div
        id={MOBILE_MENU_ID}
        ref={mobileMenuRef}
        role="dialog"
        aria-modal={mobileMenuOpen}
        aria-label="导航菜单"
        className={`fixed inset-0 z-[100001] md:hidden transition-all duration-500 ${
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
          className={`absolute top-0 left-0 h-full w-[min(320px,85vw)] bg-[#FDFBF7] shadow-2xl rounded-r-3xl transform transition-transform duration-500 ease-out ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full px-6 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.25rem+env(safe-area-inset-bottom,16px))]">
            {/* Logo */}
            <div className="flex justify-center mt-6 mb-10">
              <Image
                src="/NIHPLOD-logo.svg"
                alt="NIHPLOD"
                width={120}
                height={36}
                className="h-7 w-auto object-contain opacity-80"
              />
            </div>

            {/* 用户信息 / 登录入口 */}
            <div className="mb-10 px-4">
              {user ? (
                <Link
                  href="/profile"
                  onClick={handleNavClick}
                  className="flex items-center gap-4 group"
                >
                  <div className="relative w-14 h-14 rounded-full overflow-hidden bg-[#00263E]/10 flex items-center justify-center text-[#00263E] shrink-0">
                    {user.avatar ? (
                      <Image src={user.avatar} alt="" fill unoptimized className="object-cover" />
                    ) : (
                      <span className="text-lg font-serif">
                        {(user.name || user.email || user.phone || "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-light text-[#00263E] truncate">
                      {user.name || user.email || user.phone || "用户"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[15px] text-[#4A6272]">
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
                  <div className="w-14 h-14 rounded-full bg-[#00263E]/8 flex items-center justify-center text-[#00263E]/50 shrink-0 group-hover:bg-[#00263E]/12 transition-colors duration-300">
                    <User className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[15px] font-light text-[#00263E]">
                      未登录
                    </p>
                    <p className="text-[15px] text-[#4A6272] mt-0.5">
                      点击登录或注册
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-[#00263E]/30 group-hover:text-[#00263E]/50 transition-colors duration-300"
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
                    className={`group relative ${(item.icon || item.image) ? "flex items-center gap-2" : ""} px-4 py-4 text-[15px] font-light tracking-[0.08em] rounded-xl transition-all duration-300 ${
                      isActive
                        ? "text-[#00263E] bg-[#00263E]/8"
                        : "text-[#00263E] active:bg-[#00263E]/5"
                    }`}
                  >
                    {item.image && (
                      <Image
                        src={item.image}
                        alt=""
                        width={36}
                        height={36}
                        className="w-6 h-6 object-contain drop-shadow-[0_1px_0_rgba(0,38,62,0.28)] animate-[soft-blink_3s_ease-in-out_infinite]"
                      />
                    )}
                    {item.label}
                    {item.icon && (
                      <item.icon className="w-3.5 h-3.5" />
                    )}
                  </Link>
                );
              })}
              <a
                href="https://nihplod.cn/about"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleNavClick}
                className="group flex items-center gap-2 px-4 py-4 text-[15px] font-light tracking-[0.08em] text-[#00263E] active:bg-[#00263E]/5 rounded-xl transition-all duration-300"
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
                  className="group flex items-center gap-3 px-4 py-4 text-[15px] font-light tracking-[0.08em] text-[#00263E] active:bg-[#00263E]/5 rounded-xl transition-all duration-300"
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
