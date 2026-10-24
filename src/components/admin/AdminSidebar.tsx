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
    Wand2,
    BarChart3,
    FileSpreadsheet,
    LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/permissions";

const BASE_MENU_ITEMS = [
    { href: "/admin", label: "仪表盘", icon: LayoutDashboard },
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
        // 移动端点击导航后自动收起侧栏
        setMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        // adminFetch 统一拦截 401：会话过期时自动跳转 /admin/login
        adminFetch("/api/admin/auth/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { user?: AdminMe } | null) => {
                if (data?.user) setAdmin(data.user);
            })
            .catch(() => {});
    }, [pathname]);

    // 管理员账号统一由主站管理，子站不再提供管理员管理入口
    const menuItems = BASE_MENU_ITEMS;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                exportMenuRef.current &&
                !exportMenuRef.current.contains(event.target as Node)
            ) {
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
            const res = await fetch("/api/admin/auth/logout", {
                method: "POST",
            });
            if (!res.ok) throw new Error("Logout failed");
            router.push("/admin/login");
        } catch {
            // silently handle
        }
    };

    const roleLabel = admin?.role === "super_admin" ? "超级管理员" : "管理员";
    const pageTitle =
        menuItems.find((item) =>
            item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`),
        )?.label || "管理后台";

    return (
        <>
            <header className="fixed inset-x-0 top-0 z-[60] flex h-14 items-center gap-3 border-b border-brand-charcoal/10 bg-white/95 px-4 backdrop-blur md:hidden">
                <button
                    className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-brand-charcoal/70 transition-colors hover:bg-brand-charcoal/[0.05] hover:text-brand-charcoal"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
                    aria-expanded={mobileOpen}
                >
                    {mobileOpen ? (
                        <X className="h-5 w-5" />
                    ) : (
                        <Menu className="h-5 w-5" />
                    )}
                </button>
                <span className="text-sm font-semibold text-brand-charcoal">
                    {pageTitle}
                </span>
            </header>

            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <div
                className={cn(
                    "z-20 flex h-full flex-col border-r border-brand-charcoal/10 bg-white text-brand-charcoal transition-all duration-300 ease-in-out",
                    collapsed ? "w-16" : "w-60",
                    "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-60",
                    mobileOpen
                        ? "max-md:translate-x-0"
                        : "max-md:-translate-x-full",
                )}
            >
                <div
                    className={cn(
                        "flex h-16 items-center justify-center border-b border-brand-charcoal/10 px-3",
                    )}
                >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="relative flex shrink-0 items-center justify-center">
                            {collapsed ? (
                                <span className="font-serif text-xl font-bold text-brand-primary">
                                    N
                                </span>
                            ) : (
                                <Image
                                    src="/NIHPLOD-logo.svg"
                                    alt="NIHPLOD"
                                    width={84}
                                    height={21}
                                    className="h-[21px] w-auto transition-all duration-300"
                                    priority
                                />
                            )}
                        </div>
                        {!collapsed && (
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="w-px h-3.5 bg-brand-charcoal/15" />
                                <span className="whitespace-nowrap text-sm font-medium tracking-tight text-brand-charcoal">
                                    管理后台
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <nav
                    className="flex-1 space-y-1 overflow-y-auto px-3 py-2"
                    aria-label="管理导航"
                >
                    {!collapsed && (
                        <div className="px-3 mb-3 text-xs font-medium uppercase tracking-wider text-brand-charcoal/65">
                            功能导航
                        </div>
                    )}
                    {menuItems.map((item) => {
                        const isActive =
                            item.href === "/admin"
                                ? pathname === "/admin"
                                : pathname === item.href ||
                                  pathname.startsWith(`${item.href}/`);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "group flex items-center rounded-lg px-3 py-2 text-sm transition-colors",
                                    isActive
                                        ? "bg-brand-primary/10 font-medium text-brand-primary"
                                        : "text-brand-charcoal/70 hover:bg-brand-charcoal/[0.04] hover:text-brand-charcoal",
                                    collapsed ? "justify-center" : "",
                                )}
                                title={collapsed ? item.label : undefined}
                            >
                                <item.icon
                                    className={cn(
                                        "h-4 w-4 flex-shrink-0 transition-colors",
                                        isActive
                                            ? "text-brand-primary"
                                            : "text-brand-charcoal/70 group-hover:text-brand-charcoal",
                                        collapsed ? "mr-0" : "mr-3",
                                    )}
                                />
                                {!collapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}

                    <div className="mt-4 border-t border-brand-charcoal/10 pt-4">
                        {!collapsed && (
                            <div className="px-3 mb-2 text-xs font-medium uppercase tracking-wider text-brand-charcoal/65">
                                数据导出
                            </div>
                        )}
                        <div className="relative px-3" ref={exportMenuRef}>
                            <button
                                onClick={() =>
                                    setShowExportMenu(!showExportMenu)
                                }
                                aria-expanded={showExportMenu}
                                aria-haspopup="true"
                                className={cn(
                                    "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 w-full",
                                    showExportMenu
                                        ? "bg-brand-charcoal/[0.06] font-medium text-brand-charcoal"
                                        : "text-brand-charcoal/70 hover:bg-brand-charcoal/[0.04] hover:text-brand-charcoal",
                                    collapsed ? "justify-center" : "",
                                )}
                                title={collapsed ? "数据导出" : undefined}
                            >
                                <Download
                                    className={cn(
                                        "h-4 w-4 transition-transform duration-300",
                                        showExportMenu ? "scale-110" : "",
                                        collapsed ? "" : "mr-3",
                                    )}
                                />
                                {!collapsed && <span>数据报表</span>}
                            </button>

                            {showExportMenu && (
                                <div
                                    className={cn(
                                        "absolute z-50 w-44 overflow-hidden rounded-lg border border-brand-charcoal/10 bg-white py-1 shadow-xl",
                                        collapsed
                                            ? "left-16 bottom-0"
                                            : "left-0 bottom-full mb-2",
                                    )}
                                >
                                    {[
                                        {
                                            id: "products",
                                            label: "产品数据报表",
                                            icon: Package,
                                        },
                                        {
                                            id: "whitepaper",
                                            label: "白皮书统计数据",
                                            icon: FileSpreadsheet,
                                        },
                                        ...(isSuperAdmin(admin?.role ?? null)
                                            ? [
                                                  {
                                                      id: "users",
                                                      label: "用户增长数据",
                                                      icon: Users,
                                                  },
                                                  {
                                                      id: "sessions",
                                                      label: "诊断请求记录",
                                                      icon: Activity,
                                                  },
                                              ]
                                            : []),
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() =>
                                                handleExport(item.id)
                                            }
                                            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-brand-charcoal/80 transition-colors hover:bg-brand-charcoal/[0.06] hover:text-brand-charcoal"
                                        >
                                            <item.icon className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:text-brand-primary transition-colors" />
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </nav>

                <div className="px-3 pb-2 pt-2 border-t border-brand-charcoal/10">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-brand-charcoal/70 hover:bg-brand-charcoal/[0.05] hover:text-brand-charcoal transition-colors",
                            collapsed ? "justify-center" : "",
                        )}
                        title={collapsed ? "展开" : "收起"}
                    >
                        {collapsed ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <ChevronLeft className="h-4 w-4 mr-3" />
                        )}
                        {!collapsed && <span>收起侧边栏</span>}
                    </button>
                </div>

                {admin && !collapsed && (
                    <div className="px-3 pb-3 border-t border-brand-charcoal/10">
                        <div className="flex items-center gap-3 px-3 pt-3">
                            <div className="w-8 h-8 rounded-full bg-brand-charcoal/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-brand-charcoal/70">
                                    {(admin.name || admin.username)
                                        .charAt(0)
                                        .toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-brand-charcoal truncate">
                                    {admin.name || admin.username}
                                </div>
                                <div className="text-xs text-brand-charcoal/65">
                                    {roleLabel}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-3">
                    <button
                        onClick={handleLogout}
                        className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-brand-charcoal/70 hover:bg-brand-charcoal/[0.05] hover:text-red-600 transition-colors",
                            collapsed ? "justify-center" : "",
                        )}
                        title={collapsed ? "退出登录" : undefined}
                    >
                        <LogOut
                            className={cn(
                                "h-4 w-4",
                                collapsed ? "mr-0" : "mr-3",
                            )}
                        />
                        {!collapsed && <span>退出登录</span>}
                    </button>
                </div>
            </div>
        </>
    );
}
