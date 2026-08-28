"use client";

import { adminFetch } from "@/lib/admin-fetch";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
    Menu,
    X,
    Package,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Users,
    Shield,
    Download,
    Activity,
    UserCog,
    Wand2,
    BarChart3,
    FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/permissions";
import { motion, AnimatePresence } from "framer-motion";

const BASE_MENU_ITEMS = [
    { href: "/admin/products", label: "产品管理", icon: Package },
    { href: "/admin/recommendation-rules", label: "推荐规则", icon: Wand2 },
    { href: "/admin/ai-costs", label: "AI成本", icon: BarChart3 },
    { href: "/admin/users", label: "用户管理", icon: Users },
    { href: "/admin/audit-logs", label: "安全审计", icon: Shield },
];

interface AdminMe {
    id: string;
    name: string;
    username: string;
    role: string;
}

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [admin, setAdmin] = useState<AdminMe | null>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // adminFetch 统一拦截 401：会话过期时自动跳转 /admin/login
        adminFetch("/api/admin/auth/me")
            .then(res => res.ok ? res.json() : null)
            .then((data: { user?: AdminMe } | null) => {
                if (data?.user) setAdmin(data.user);
            })
            .catch(() => {});
    }, [pathname]);

    const menuItems = isSuperAdmin(admin?.role ?? null)
        ? [...BASE_MENU_ITEMS, { href: "/admin/admins", label: "管理员", icon: UserCog }]
        : BASE_MENU_ITEMS;

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
            if (!res.ok) throw new Error("Logout failed");
            router.push("/admin/login");
        } catch {
            // silently handle
        }
    };

    const roleLabel = admin?.role === "super_admin" ? "超级管理员" : "管理员";

    return (
        <>
            <button
                className="md:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-white shadow-md border border-[#1A1A1A]/10"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
            >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <div
                className={cn(
                    "flex h-full flex-col bg-[#FDFBF7] text-[#1A1A1A] z-20 transition-all duration-300 ease-in-out border-r border-[#1A1A1A]/5",
                    collapsed ? "w-20" : "w-64",
                    "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-64",
                    mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
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
                                <div className="w-px h-3.5 bg-slate-300" />
                                <span className="text-[13px] font-medium tracking-tight text-[#1A1A1A] whitespace-nowrap">
                                    护肤顾问管理系统
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto" aria-label="管理导航">
                    {!collapsed && (
                        <div className="px-3 mb-3 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/40 animate-in fade-in duration-300">
                            功能导航
                        </div>
                    )}
                    {menuItems.map((item) => {
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

                    <div className="mt-4 pt-4 border-t border-[#1A1A1A]/5">
                        {!collapsed && (
                            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/40 animate-in fade-in duration-300">
                                数据导出
                            </div>
                        )}
                        <div className="relative px-3" ref={exportMenuRef}>
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                aria-expanded={showExportMenu}
                                aria-haspopup="true"
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
                                            { id: 'whitepaper', label: '白皮书统计数据', icon: FileSpreadsheet },
                                            ...(isSuperAdmin(admin?.role ?? null) ? [
                                                { id: 'users', label: '用户增长数据', icon: Users },
                                                { id: 'sessions', label: '诊断请求记录', icon: Activity },
                                            ] : []),
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

                {admin && !collapsed && (
                    <div className="px-3 pb-3 border-t border-[#1A1A1A]/5">
                        <div className="flex items-center gap-3 px-3 pt-3">
                            <div className="w-8 h-8 rounded-full bg-[#1A1A1A]/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-[#1A1A1A]/60">
                                    {(admin.name || admin.username).charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-[#1A1A1A] truncate">
                                    {admin.name || admin.username}
                                </div>
                                <div className="text-[10px] text-[#1A1A1A]/40 uppercase tracking-wider">{roleLabel}</div>
                            </div>
                        </div>
                    </div>
                )}

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
        </>
    );
}
