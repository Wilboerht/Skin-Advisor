"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Package,
    Gift,
    Settings,
    LogOut,
    FileText,
    ChevronLeft,
    ChevronRight,
    Users,
    Shield,
    Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
    { href: "/admin", label: "控制台概览", icon: LayoutDashboard },
    { href: "/admin/products", label: "产品管理", icon: Package },
    { href: "/admin/users", label: "用户管理", icon: Users },
    { href: "/admin/campaigns", label: "活动中心", icon: FileText },
    { href: "/admin/rewards", label: "领奖审批", icon: Gift },
    { href: "/admin/settings", label: "系统设置", icon: Settings },
    { href: "/admin/audit-logs", label: "安全审计", icon: Shield },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const handleExport = (type: string) => {
        window.open(`/api/admin/export?type=${type}`, "_blank");
        setShowExportMenu(false);
    };

    const handleLogout = async () => {
        await fetch("/api/admin/auth/logout", { method: "POST" });
        router.push("/admin/login");
    };

    return (
        <div
            className={cn(
                "flex h-full flex-col bg-[#FDFBF7] text-[#1A1A1A] z-20 transition-all duration-300 ease-in-out border-r border-[#1A1A1A]/5",
                collapsed ? "w-20" : "w-64"
            )}
        >
            <div className={cn("flex h-20 items-center px-6 gap-3 border-b border-[#1A1A1A]/5", collapsed ? "justify-center px-0" : "")}>
                <div className="flex items-center justify-center shrink-0">
                    <Image
                        src="/images/NIHPLOD-logo.svg"
                        alt="MySkin.Today"
                        width={32}
                        height={32}
                        className="h-8 w-auto opacity-90"
                    />
                </div>
                {!collapsed && (
                    <div className="animate-in fade-in duration-300 overflow-hidden whitespace-nowrap">
                        <span className="block text-sm font-bold tracking-tight text-[#1A1A1A]">MySkin.Today</span>
                        <span className="block text-[10px] font-medium text-[#1A1A1A]/40 tracking-wider uppercase">管理后台</span>
                    </div>
                )}
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

                {/* Export Dropdown */}
                <div className="relative mt-4 pt-4 border-t border-[#1A1A1A]/5">
                    {!collapsed && (
                        <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/40 animate-in fade-in duration-300">
                            数据导出
                        </div>
                    )}
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className={cn(
                            "group flex items-center rounded-lg px-3 py-2 text-sm font-medium text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A] transition-colors w-full",
                            collapsed ? "justify-center" : ""
                        )}
                        title={collapsed ? "数据导出" : undefined}
                    >
                        <Download className={cn("h-4 w-4", collapsed ? "mr-0" : "mr-3")} />
                        {!collapsed && <span>数据导出</span>}
                    </button>

                    {showExportMenu && (
                        <div className={cn(
                            "absolute z-20 bg-white border border-[#1A1A1A]/10 rounded-lg shadow-lg py-1 w-40",
                            collapsed ? "left-20 bottom-0" : "left-3 bottom-full mb-1"
                        )}>
                            <button onClick={() => handleExport("products")} className="w-full px-3 py-2 text-left text-sm hover:bg-[#1A1A1A]/5">
                                产品数据
                            </button>
                            <button onClick={() => handleExport("users")} className="w-full px-3 py-2 text-left text-sm hover:bg-[#1A1A1A]/5">
                                用户数据
                            </button>
                            <button onClick={() => handleExport("sessions")} className="w-full px-3 py-2 text-left text-sm hover:bg-[#1A1A1A]/5">
                                会话请求
                            </button>
                            <button onClick={() => handleExport("rewards")} className="w-full px-3 py-2 text-left text-sm hover:bg-[#1A1A1A]/5">
                                奖励记录
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            <div className="px-3 pb-2 pt-2 border-t border-[#1A1A1A]/5">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium text-[#1A1A1A]/50 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A] transition-colors",
                        collapsed ? "justify-center" : ""
                    )}
                    title={collapsed ? "展开" : "收起"}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 mr-2" />}
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
