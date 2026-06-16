"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { User, ExternalLink } from "lucide-react";
import { HomeSvg } from "@/components/icons/HomeSvg";
import { useAuthModal } from "@/components/auth/AuthModalContext";

const navItems = [
  { label: "素颜测肤", href: "/" },
  { label: "肌肤性格", href: "/skin-types" },
  { label: "更多服务", href: "/services" },
];

export function WebsiteNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const { openAuthModal } = useAuthModal();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-12 lg:px-20 py-6 md:py-7 transition-all duration-500 ${
        scrolled
          ? "bg-[#F5F2E9]/80 backdrop-blur-md border-b border-[rgba(61,68,48,0.06)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center">
        <Link href="/" className="cursor-pointer justify-self-start">
          <Image
            src="/NIHPLOD-logo.svg"
            alt="NIHPLOD"
            width={120}
            height={36}
            className="h-9 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-500"
          />
        </Link>

        {/* 中间导航 */}
        <div className="hidden md:flex items-center justify-center gap-8 lg:gap-10">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`group relative text-[15px] font-medium tracking-[0.2em] transition-colors duration-500 ${
                  isActive
                    ? "text-[#3D4430]"
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
            className="group relative flex items-center gap-1.5 text-[15px] font-medium tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] transition-colors duration-500"
          >
            探索旎柏
            <ExternalLink className="w-3.5 h-3.5 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
          </a>
        </div>

        <div className="flex items-center justify-end gap-5 md:gap-7">
          <button
            onClick={() => openAuthModal("login")}
            className="group flex items-center gap-2 text-[15px] font-medium tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] transition-colors duration-500 cursor-pointer"
          >
            <User className="w-5 h-5 sm:w-[1.125rem] sm:h-[1.125rem] transition-opacity duration-500" />
            <span className="hidden sm:inline relative">
              登录
              <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
            </span>
          </button>
          {pathname !== "/" && (
            <Link
              href="/"
              className="group flex items-center gap-2 text-[15px] font-medium tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] transition-colors duration-500"
            >
              <HomeSvg className="w-6 h-6 sm:w-5 sm:h-5 transition-opacity duration-500" />
              <span className="hidden sm:inline relative">
                首页
                <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
              </span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
