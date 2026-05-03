"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Package,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Users,
    Shield,
    Download,
    Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const MENU_ITEMS = [
    { href: "/admin/products", label: "产品管理", icon: Package },
    { href: "/admin/users", label: "用户管理", icon: Users },
    { href: "/admin/audit-logs", label: "安全审计", icon: Shield },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Close export menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        }

        if (showExportMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showExportMenu]);

    const handleExport = (type: string) => {
        window.open(`/api/admin/export?type=${type}`, "_blank");
        setShowExportMenu(false);
    };

    const handleLogout = async () => {
        try {
            const res = await fetch("/api/admin/auth/logout", { method: "POST" });
            if (!res.ok) {
                throw new Error("Logout failed");
            }
            router.push("/admin/login");
        } catch {
            alert("退出登录失败，请重试");
        }
    };

    return (
        <div
            className={cn(
                "flex h-full flex-col bg-[#FDFBF7] text-[#1A1A1A] z-20 transition-all duration-300 ease-in-out border-r border-[#1A1A1A]/5",
                collapsed ? "w-20" : "w-64"
            )}
        >
            <div className={cn("flex h-20 items-center justify-center border-b border-[#1A1A1A]/5 px-2")}>
                <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="flex items-center justify-center shrink-0 relative">
                        <Image
                            src="/NIHPLOD-logo.svg"
                            alt="NIHPLOD"
                            width={collapsed ? 64 : 84}
                            height={collapsed ? 16 : 21}
                            className={cn(
                                "w-auto transition-all duration-300",
                                collapsed ? "h-4" : "h-[21px]"
                            )}
                            priority
                        />
                    </div>
                    {!collapsed && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300 shrink-0">
                            <div className="w-px h-3.5 bg-slate-300"></div>
                            <span className="text-[13px] font-medium tracking-tight text-[#1A1A1A] whitespace-nowrap">
                                护肤顾问管理系统
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-6">
                {!collapsed && (
                    <div className="px-3 mb-3 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/40 animate-in fade-in duration-300">
                        功能导航
                    </div>
                )}
                {MENU_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-[#1A1A1A]/5 text-[#1A1A1A]"
                                    : "text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A]",
                                collapsed ? "justify-center" : ""
                            )}
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", isActive ? "text-[#1A1A1A]" : "text-[#1A1A1A]/60 group-hover:text-[#1A1A1A]", collapsed ? "mr-0" : "mr-3")} />
                            {!collapsed && (
                                <span className="animate-in fade-in duration-200">{item.label}</span>
                            )}
                        </Link>
                    );
                })}

                {/* Export Actions - Refined Liquid Glass */}
                <div className="mt-4 pt-4 border-t border-[#1A1A1A]/5">
                    {!collapsed && (
                        <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/40 animate-in fade-in duration-300">
                            数据导出
                        </div>
                    )}
                    <div className="relative px-3" ref={exportMenuRef}>
                        <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className={cn(
                                "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 w-full",
                                showExportMenu 
                                    ? "bg-slate-900/10 text-slate-900 ring-1 ring-slate-950/5 shadow-sm" 
                                    : "text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A]",
                                collapsed ? "justify-center" : ""
                            )}
                            title={collapsed ? "数据导出" : undefined}
                        >
                            <Download className={cn("h-4 w-4 transition-transform duration-300", showExportMenu ? "scale-110" : "", collapsed ? "" : "mr-3")} />
                            {!collapsed && <span>数据报表</span>}
                        </button>

                        <AnimatePresence>
                            {showExportMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className={cn(
                                        "absolute z-50 bg-white/60 backdrop-blur-3xl border border-white/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] py-1.5 w-44 overflow-hidden",
                                        collapsed ? "left-16 bottom-0" : "left-0 bottom-full mb-2"
                                    )}
                                >
                                    {[
                                        { id: 'products', label: '产品数据报表', icon: Package },
                                        { id: 'users', label: '用户增长数据', icon: Users },
                                        { id: 'sessions', label: '诊断请求记录', icon: Activity },

                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleExport(item.id)}
                                            className="group w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-900 transition-all active:scale-[0.98]"
                                        >
                                            <item.icon className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:text-indigo-500 transition-colors" />
                                            {item.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </nav>

            <div className="px-3 pb-2 pt-2 border-t border-[#1A1A1A]/5">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A] transition-colors",
                        collapsed ? "justify-center" : ""
                    )}
                    title={collapsed ? "展开" : "收起"}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 mr-3" />}
                    {!collapsed && <span>收起侧边栏</span>}
                </button>
            </div>

            <div className="p-3">
                <button
                    onClick={handleLogout}
                    className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 hover:text-red-600 transition-colors",
                        collapsed ? "justify-center" : ""
                    )}
                    title={collapsed ? "退出登录" : undefined}
                >
                    <LogOut className={cn("h-4 w-4", collapsed ? "mr-0" : "mr-3")} />
                    {!collapsed && <span>退出登录</span>}
                </button>
            </div>
        </div>
    );
}
