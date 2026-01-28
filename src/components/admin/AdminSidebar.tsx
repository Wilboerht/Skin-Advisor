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
} from "lucide-react";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/questions", label: "Questions", icon: FileText },
    { href: "/admin/rewards", label: "Rewards", icon: Gift },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: Shield },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);

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
                        src="/logo-myskin-today.svg"
                        alt="MySkin.Today"
                        width={32}
                        height={32}
                        className="h-8 w-auto opacity-90"
                    />
                </div>
                {!collapsed && (
                    <div className="animate-in fade-in duration-300 overflow-hidden whitespace-nowrap">
                        <span className="block text-sm font-bold tracking-tight text-[#1A1A1A]">MySkin.Today</span>
                        <span className="block text-[10px] font-medium text-[#1A1A1A]/40 tracking-wider uppercase">Admin Console</span>
                    </div>
                )}
            </div>

            <nav className="flex-1 space-y-1 px-3 py-6">
                {!collapsed && (
                    <div className="px-3 mb-3 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]/40 animate-in fade-in duration-300">
                        Navigation
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
            </nav>

            <div className="px-3 pb-2 pt-2 border-t border-[#1A1A1A]/5">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium text-[#1A1A1A]/50 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A] transition-colors",
                        collapsed ? "justify-center" : ""
                    )}
                    title={collapsed ? "Expand" : "Collapse"}
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 mr-2" />}
                    {!collapsed && <span>Collapse Sidebar</span>}
                </button>
            </div>

            <div className="p-3">
                <button
                    onClick={handleLogout}
                    className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 hover:text-red-600 transition-colors",
                        collapsed ? "justify-center" : ""
                    )}
                    title={collapsed ? "Sign Out" : undefined}
                >
                    <LogOut className={cn("h-4 w-4", collapsed ? "mr-0" : "mr-3")} />
                    {!collapsed && <span>Sign Out</span>}
                </button>
            </div>
        </div>
    );
}
