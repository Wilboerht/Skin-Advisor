"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";
import { HomeSvg } from "@/components/icons/HomeSvg";
import { useAuthModal } from "@/components/auth/AuthModalContext";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { openAuthModal } = useAuthModal();

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
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="cursor-pointer">
          <Image
            src="/NIHPLOD-logo.svg"
            alt="NIHPLOD"
            width={120}
            height={36}
            className="h-8 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-500"
          />
        </Link>
        <div className="flex items-center gap-5 md:gap-7">
          <button
            onClick={() => openAuthModal("login")}
            className="group flex items-center gap-2 text-[13px] font-medium tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] transition-colors duration-500 cursor-pointer"
          >
            <User className="w-5 h-5 sm:w-4 sm:h-4 transition-opacity duration-500" />
            <span className="hidden sm:inline relative">
              登录
              <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
            </span>
          </button>
          <Link
            href="/"
            className="group flex items-center gap-2 text-[13px] font-medium tracking-[0.2em] text-[#3D4430]/70 hover:text-[#3D4430] transition-colors duration-500"
          >
            <HomeSvg className="w-6 h-6 sm:w-5 sm:h-5 transition-opacity duration-500" />
            <span className="hidden sm:inline relative">
              首页
              <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-[#3D4430]/30 group-hover:w-full transition-all duration-500 ease-out" />
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
