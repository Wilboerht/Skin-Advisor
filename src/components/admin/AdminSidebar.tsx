
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Package,
    Gift,
    Settings,
    LogOut,
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/questions", label: "Questions", icon: FileText },
    { href: "/admin/rewards", label: "Rewards", icon: Gift },
    { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await fetch("/api/admin/auth/logout", { method: "POST" });
        router.push("/admin/login");
    };

    return (
        <div className="flex h-full w-64 flex-col bg-brand-charcoal text-white">
            <div className="flex h-16 items-center px-6 font-serif text-xl font-bold tracking-wider text-brand-gold">
                NIHPLOD CMS
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
                {MENU_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-white/10 text-white"
                                    : "text-white/70 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-white/10 p-4">
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
                >
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
