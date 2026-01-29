"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, X, Bell, BellOff } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface LowStockProduct {
    id: string;
    name: string;
    stock: number;
}

interface StockAlertData {
    lowStockCount: number;
    outOfStockCount: number;
    products: LowStockProduct[];
}

export function StockAlertBanner() {
    const [data, setData] = useState<StockAlertData | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);

    // 使用 toast，注意 useToast() 返回的是 toast 对象（success/error/info/warning）
    const toast = useToast();

    useEffect(() => {
        // Check notification permission
        if (typeof window !== "undefined" && "Notification" in window) {
            setNotificationPermission(Notification.permission);
            setNotificationsEnabled(
                localStorage.getItem("stock_notifications") === "enabled"
            );
        }

        // Fetch stock data
        const fetchStockData = async () => {
            try {
                // 1. Fetch settings for threshold
                let threshold = 10;
                try {
                    const settingsRes = await fetch('/api/admin/settings');
                    if (settingsRes.ok) {
                        const settingsData = await settingsRes.json();
                        if (settingsData.success && settingsData.data.stockAlertThreshold) {
                            threshold = settingsData.data.stockAlertThreshold;
                        }
                    }
                } catch (e) {
                    console.warn("Failed to fetch settings, utilizing default threshold 10");
                }

                // 2. Fetch products
                const res = await fetch('/api/admin/products');
                if (res.ok) {
                    const products = await res.json();
                    const productsList = Array.isArray(products) ? products : (products.data || []);

                    const lowStock = productsList.filter((p: any) => p.stock > 0 && p.stock <= threshold);
                    const outOfStock = productsList.filter((p: any) => p.stock <= 0);

                    const alertData: StockAlertData = {
                        lowStockCount: lowStock.length,
                        outOfStockCount: outOfStock.length,
                        products: [...outOfStock, ...lowStock].slice(0, 5).map((p: any) => ({
                            id: p.id,
                            name: p.name,
                            stock: p.stock
                        }))
                    };

                    setData(alertData);

                    // 3. Logic: Show Toast Notification on Initial Load (Session based)
                    // 使用 sessionStorage 避免每次刷新都弹窗，但如果是新打开的 tab 会弹
                    const hasShownToast = sessionStorage.getItem("stock_alert_toast_shown");
                    if (!hasShownToast && (alertData.lowStockCount > 0 || alertData.outOfStockCount > 0)) {
                        toast.error(
                            `库存警报: ${alertData.outOfStockCount}个售罄, ${alertData.lowStockCount}个不足 (阈值: ${threshold})`,
                            8000 // Long duration
                        );
                        sessionStorage.setItem("stock_alert_toast_shown", "true");
                    }

                    // 4. Send browser notification if enabled
                    if (
                        localStorage.getItem("stock_notifications") === "enabled" &&
                        Notification.permission === "granted" &&
                        (alertData.lowStockCount > 0 || alertData.outOfStockCount > 0)
                    ) {
                        const lastNotified = localStorage.getItem("last_stock_notification");
                        const now = Date.now();
                        // Only notify once per hour
                        if (!lastNotified || now - parseInt(lastNotified) > 3600000) {
                            new Notification("库存预警 - MySkin Today", {
                                body: `${alertData.outOfStockCount} 个产品已售罄，${alertData.lowStockCount} 个产品库存不足`,
                                icon: "/favicon.ico",
                                tag: "stock-alert"
                            });
                            localStorage.setItem("last_stock_notification", now.toString());
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch stock data", error);
            }
        };

        fetchStockData();
        // Refresh every 5 minutes
        const interval = setInterval(fetchStockData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [toast]);

    const requestNotificationPermission = async () => {
        if (!("Notification" in window)) {
            alert("您的浏览器不支持推送通知");
            return;
        }

        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);

        if (permission === "granted") {
            setNotificationsEnabled(true);
            localStorage.setItem("stock_notifications", "enabled");
            new Notification("通知已启用", {
                body: "当库存不足时你将收到提醒",
                icon: "/favicon.ico"
            });
        }
    };

    const toggleNotifications = () => {
        if (notificationsEnabled) {
            setNotificationsEnabled(false);
            localStorage.setItem("stock_notifications", "disabled");
        } else {
            if (notificationPermission === "granted") {
                setNotificationsEnabled(true);
                localStorage.setItem("stock_notifications", "enabled");
            } else {
                requestNotificationPermission();
            }
        }
    };

    // Don't show if no data, dismissed, or no issues
    if (!data || dismissed || (data.lowStockCount === 0 && data.outOfStockCount === 0)) {
        return null;
    }

    const hasOutOfStock = data.outOfStockCount > 0;
    const bannerClass = hasOutOfStock
        ? "bg-gradient-to-r from-red-500 to-red-600"
        : "bg-gradient-to-r from-amber-500 to-orange-500";

    return (
        <div className={`${bannerClass} text-white px-4 py-3 rounded-xl mb-6 shadow-lg animate-in slide-in-from-top-2 duration-300`}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-semibold">
                            {hasOutOfStock ? "紧急库存警告" : "库存预警"}
                        </p>
                        <p className="text-sm text-white/90">
                            {data.outOfStockCount > 0 && (
                                <span className="font-medium">{data.outOfStockCount} 个产品已售罄</span>
                            )}
                            {data.outOfStockCount > 0 && data.lowStockCount > 0 && "，"}
                            {data.lowStockCount > 0 && (
                                <span>{data.lowStockCount} 个产品库存不足</span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Notification toggle */}
                    <button
                        onClick={toggleNotifications}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${notificationsEnabled
                            ? "bg-white/20 hover:bg-white/30"
                            : "bg-white/10 hover:bg-white/20"
                            }`}
                        title={notificationsEnabled ? "关闭推送通知" : "开启推送通知"}
                    >
                        {notificationsEnabled ? (
                            <>
                                <Bell className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">通知已开启</span>
                            </>
                        ) : (
                            <>
                                <BellOff className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">开启通知</span>
                            </>
                        )}
                    </button>

                    <Link
                        href="/admin/products?filter=low"
                        className="rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-slate-900 shadow-sm hover:bg-white/90 transition-colors whitespace-nowrap"
                    >
                        立即处理
                    </Link>

                    <button
                        onClick={() => setDismissed(true)}
                        className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                        title="暂时关闭"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Quick preview of affected products */}
            {data.products.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {data.products.map((product) => (
                        <Link
                            key={product.id}
                            href={`/admin/products/${product.id}/edit`}
                            className="flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-xs hover:bg-white/25 transition-colors"
                        >
                            <span className="truncate max-w-[120px]">{product.name}</span>
                            <span className={`font-bold ${product.stock <= 0 ? 'text-white' : 'text-white/80'}`}>
                                {product.stock <= 0 ? "售罄" : `${product.stock}件`}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
