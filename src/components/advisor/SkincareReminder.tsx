"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Clock, Moon, Sun, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";

interface ReminderSettings {
    enabled: boolean;
    morningTime: string;  // HH:mm format
    eveningTime: string;  // HH:mm format
    morningEnabled: boolean;
    eveningEnabled: boolean;
}

const DEFAULT_SETTINGS: ReminderSettings = {
    enabled: false,
    morningTime: "07:30",
    eveningTime: "21:00",
    morningEnabled: true,
    eveningEnabled: true,
};

const STORAGE_KEY = "skincare_reminder_settings";

export function SkincareReminder() {
    const { user } = useAuth();
    const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_SETTINGS);
    const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
    const [isOpen, setIsOpen] = useState(false);
    const toast = useToast();

    // Load settings logic
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check rights
        if (!("Notification" in window)) {
            setPermission("unsupported");
            return;
        }
        setPermission(Notification.permission);

        // 1. Try load from localStorage first (fast)
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setSettings(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse reminder settings");
            }
        }

        // 2. If logged in, fetch from server (authoritative)
        if (user) {
            fetch("/api/user/reminder")
                .then(res => res.json())
                .then(data => {
                    if (data.settings) {
                        // Merge or overwrite? Let's overwrite for consistency across devices
                        const serverSettings = {
                            enabled: data.settings.enabled,
                            morningTime: data.settings.morningTime,
                            eveningTime: data.settings.eveningTime,
                            morningEnabled: data.settings.morningEnabled,
                            eveningEnabled: data.settings.eveningEnabled,
                        };
                        setSettings(serverSettings);
                        // Also update local cache
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverSettings));
                    }
                })
                .catch(err => console.error("Failed to fetch settings", err));
        }
    }, [user]);

    // Save settings when changed
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Local save
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

        // Server save (debounce could be better, but simple is ok for now)
        if (user) {
            const timer = setTimeout(() => {
                fetch("/api/user/reminder", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(settings)
                }).catch(err => console.error("Failed to save settings", err));
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [settings, user]);

    // Schedule reminders
    useEffect(() => {
        if (!settings.enabled || permission !== "granted") return;

        const checkAndNotify = () => {
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

            if (settings.morningEnabled && currentTime === settings.morningTime) {
                showNotification("morning");
            }
            if (settings.eveningEnabled && currentTime === settings.eveningTime) {
                showNotification("evening");
            }
        };

        // Check every minute
        const interval = setInterval(checkAndNotify, 60000);

        return () => clearInterval(interval);
    }, [settings, permission]);


    // Helper to convert VAPID key
    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    // Register Service Worker
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js")
                .then(registration => {
                    console.log("SW registered:", registration);
                })
                .catch(err => console.error("SW registration failed:", err));
        }
    }, []);

    const subscribeToPush = async () => {
        if (!("serviceWorker" in navigator)) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
            });

            // Send to backend
            await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subscription: sub, userAgent: navigator.userAgent })
            });

            return sub;
        } catch (e) {
            console.error("Push subscription failed", e);
            throw e;
        }
    };

    const showNotification = (type: "morning" | "evening") => {
        // Fallback to local if permission granted but SW fetch failed or just local logic
        if (permission !== "granted") return;

        const title = type === "morning" ? "☀️ 早安护肤提醒" : "🌙 晚间护肤提醒";
        const body = type === "morning"
            ? "开始新的一天！别忘了做好防晒和基础护理 ✨"
            : "辛苦一天了！卸妆清洁后开始你的晚间护理吧 🌸";

        new Notification(title, { body, icon: "/images/NIHPLOD-logo.svg" });
    };

    const requestPermission = async () => {
        if (!("Notification" in window)) {
            toast.error("您的浏览器不支持通知功能");
            return;
        }

        try {
            const result = await Notification.requestPermission();
            setPermission(result);

            if (result === "granted") {
                toast.success("通知权限已开启！正在注册推送服务...");
                try {
                    await subscribeToPush();
                    toast.success("推送服务连接成功！");
                    setSettings(prev => ({ ...prev, enabled: true }));
                } catch (e) {
                    toast.error("推送服务连接失败，仅启用本地通知");
                    setSettings(prev => ({ ...prev, enabled: true }));
                }
            } else if (result === "denied") {
                toast.error("通知权限被拒绝，请在浏览器设置中开启");
            }
        } catch (e) {
            toast.error("请求通知权限失败");
        }
    };

    const toggleEnabled = () => {
        if (!settings.enabled && permission !== "granted") {
            requestPermission();
        } else {
            setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
            if (!settings.enabled && permission === "granted") {
                // Re-subscribe just in case
                subscribeToPush().catch(console.error);
            }
            toast.success(settings.enabled ? "护肤提醒已关闭" : "护肤提醒已开启");
        }
    };

    const testNotification = async () => {
        if (permission !== "granted") {
            requestPermission();
            return;
        }

        // Try active SW push first
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            const sub = await registration?.pushManager.getSubscription();

            if (sub) {
                toast.info("正在发送测试推送...");
                const res = await fetch("/api/push/send-test", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        endpoint: sub.endpoint,
                        title: "测试推送",
                        message: "这是一条来自 Service Worker 的测试推送！"
                    })
                });
                if (res.ok) toast.success("测试推送已发送！");
                else throw new Error("API Error");
            } else {
                showNotification("morning");
                toast.success("本地测试通知已发送 (SW未订阅)");
            }
        } catch (e) {
            // Fallback
            showNotification("morning");
            toast.success("本地测试通知已发送 (Fallback)");
        }
    };

    if (permission === "unsupported") {
        return null;
    }

    return (
        <div className="relative">
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${settings.enabled
                    ? "bg-[#3D4430]/10 text-[#3D4430] hover:bg-[#3D4430]/20"
                    : "bg-[#1A1A1A]/5 text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/10"
                    }`}
            >
                {settings.enabled ? (
                    <Bell className="w-4 h-4" />
                ) : (
                    <BellOff className="w-4 h-4" />
                )}
                <span>护肤提醒</span>
            </button>

            {/* Settings Dropdown */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white rounded-2xl border border-[#1A1A1A]/10 shadow-lg p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium text-[#1A1A1A]">护肤提醒设置</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Enable Toggle */}
                        <div className="flex items-center justify-between p-3 bg-[#FDFBF7] rounded-lg mb-4">
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-[#3D4430]" />
                                <span className="text-sm font-medium">开启提醒</span>
                            </div>
                            <button
                                onClick={toggleEnabled}
                                className={`w-12 h-6 rounded-full transition-all relative ${settings.enabled ? "bg-[#3D4430]" : "bg-[#1A1A1A]/20"
                                    }`}
                            >
                                <span
                                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.enabled ? "translate-x-7" : "translate-x-1"
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Time Settings */}
                        <div className="space-y-3">
                            {/* Morning */}
                            <div className={`p-3 rounded-lg border transition-opacity ${settings.morningEnabled ? "border-[#1A1A1A]/10" : "border-[#1A1A1A]/5 opacity-50"
                                }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Sun className="w-4 h-4 text-amber-500" />
                                        <span className="text-sm">早间提醒</span>
                                    </div>
                                    <button
                                        onClick={() => setSettings(prev => ({ ...prev, morningEnabled: !prev.morningEnabled }))}
                                        className={`w-5 h-5 rounded border flex items-center justify-center ${settings.morningEnabled
                                            ? "bg-[#3D4430] border-[#3D4430] text-white"
                                            : "border-[#1A1A1A]/20"
                                            }`}
                                    >
                                        {settings.morningEnabled && <Check className="w-3 h-3" />}
                                    </button>
                                </div>
                                <input
                                    type="time"
                                    value={settings.morningTime}
                                    onChange={(e) => setSettings(prev => ({ ...prev, morningTime: e.target.value }))}
                                    disabled={!settings.morningEnabled}
                                    className="w-full px-3 py-2 text-sm border border-[#1A1A1A]/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3D4430]/30 disabled:opacity-50"
                                />
                            </div>

                            {/* Evening */}
                            <div className={`p-3 rounded-lg border transition-opacity ${settings.eveningEnabled ? "border-[#1A1A1A]/10" : "border-[#1A1A1A]/5 opacity-50"
                                }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Moon className="w-4 h-4 text-indigo-500" />
                                        <span className="text-sm">晚间提醒</span>
                                    </div>
                                    <button
                                        onClick={() => setSettings(prev => ({ ...prev, eveningEnabled: !prev.eveningEnabled }))}
                                        className={`w-5 h-5 rounded border flex items-center justify-center ${settings.eveningEnabled
                                            ? "bg-[#3D4430] border-[#3D4430] text-white"
                                            : "border-[#1A1A1A]/20"
                                            }`}
                                    >
                                        {settings.eveningEnabled && <Check className="w-3 h-3" />}
                                    </button>
                                </div>
                                <input
                                    type="time"
                                    value={settings.eveningTime}
                                    onChange={(e) => setSettings(prev => ({ ...prev, eveningTime: e.target.value }))}
                                    disabled={!settings.eveningEnabled}
                                    className="w-full px-3 py-2 text-sm border border-[#1A1A1A]/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3D4430]/30 disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Test Button */}
                        <button
                            onClick={testNotification}
                            className="w-full mt-4 px-4 py-2 text-sm font-medium text-[#3D4430] bg-[#3D4430]/10 rounded-lg hover:bg-[#3D4430]/20 transition-colors"
                        >
                            发送测试通知
                        </button>

                        {permission === "denied" && (
                            <p className="mt-3 text-xs text-red-500 text-center">
                                通知权限被拒绝，请在浏览器设置中开启
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
