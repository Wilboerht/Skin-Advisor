"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut, User as UserIcon, Clock, ChevronRight, Loader2, Save, Smartphone, Sparkles, User, LayoutGrid, Calendar, Bell, BellOff, Sun, Moon, Check } from "lucide-react";

interface HistorySession {
    sessionId: string;
    completedAt: string;
    analysisResult: any;
}

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ReminderSettings {
    enabled: boolean;
    morningTime: string;
    eveningTime: string;
    morningEnabled: boolean;
    eveningEnabled: boolean;
}

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
    enabled: false,
    morningTime: "07:30",
    eveningTime: "21:00",
    morningEnabled: true,
    eveningEnabled: true,
};

const REMINDER_STORAGE_KEY = "skincare_reminder_settings";

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { user, refresh, logout } = useAuth();
    const router = useRouter();
    const toast = useToast();

    // UI State
    const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'reminder'>('profile');

    // Reminder State
    const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");

    // History State
    const [auditHistory, setAuditHistory] = useState<HistorySession[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Profile Edit State
    const [editName, setEditName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Initialize data
    useEffect(() => {
        if (isOpen && user) {
            setEditName(user.name || "");

            // Check notification permission
            if (typeof window !== "undefined") {
                if (!("Notification" in window)) {
                    setNotificationPermission("unsupported");
                } else {
                    setNotificationPermission(Notification.permission);
                }

                // Load reminder settings from localStorage
                const saved = localStorage.getItem(REMINDER_STORAGE_KEY);
                if (saved) {
                    try {
                        setReminderSettings(JSON.parse(saved));
                    } catch (e) {
                        console.error("Failed to parse reminder settings");
                    }
                }

                // Fetch from server if logged in
                fetch("/api/user/reminder")
                    .then(res => res.json())
                    .then(data => {
                        if (data.settings) {
                            const serverSettings = {
                                enabled: data.settings.enabled,
                                morningTime: data.settings.morningTime,
                                eveningTime: data.settings.eveningTime,
                                morningEnabled: data.settings.morningEnabled,
                                eveningEnabled: data.settings.eveningEnabled,
                            };
                            setReminderSettings(serverSettings);
                            localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(serverSettings));
                        }
                    })
                    .catch(err => console.error("Failed to fetch reminder settings", err));
            }

            const fetchHistory = async () => {
                setLoadingHistory(true);
                try {
                    const res = await fetch("/api/advisor/history");
                    if (res.ok) {
                        const data = await res.json();
                        setAuditHistory(data.history);
                    }
                } catch (e) {
                    console.error("History fetch error:", e);
                } finally {
                    setLoadingHistory(false);
                }
            };
            fetchHistory();
        }
    }, [isOpen, user]);

    const handleSaveProfile = async () => {
        if (!editName.trim()) {
            toast.error("昵称不能为空");
            return;
        }
        if (editName === user?.name) return;

        setIsSaving(true);
        try {
            const res = await fetch("/api/auth/me", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName })
            });

            if (res.ok) {
                toast.success("保存成功");
                await refresh();
            } else {
                const data = await res.json();
                toast.error(data.error || "保存失败");
            }
        } catch (e) {
            toast.error("请求失败");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            toast.success("已安全退出");
            onClose();
        } catch (e) {
            toast.error("退出失败");
        }
    };

    // --- Reminder Functions ---
    const saveReminderSettings = useCallback((newSettings: ReminderSettings) => {
        setReminderSettings(newSettings);
        localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(newSettings));

        // Save to server
        if (user) {
            fetch("/api/user/reminder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSettings)
            }).catch(err => console.error("Failed to save reminder settings", err));
        }
    }, [user]);

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

    const subscribeToPush = async () => {
        if (!("serviceWorker" in navigator)) return;

        // Check if VAPID key is configured
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
            console.warn("[Push] VAPID public key not configured, skipping push subscription");
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
            });

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

    const requestNotificationPermission = async () => {
        if (!("Notification" in window)) {
            toast.error("您的浏览器不支持通知功能");
            return;
        }

        try {
            const result = await Notification.requestPermission();
            setNotificationPermission(result);

            if (result === "granted") {
                toast.success("通知权限已开启！正在注册推送服务...");
                try {
                    await subscribeToPush();
                    toast.success("推送服务连接成功！");
                    saveReminderSettings({ ...reminderSettings, enabled: true });
                } catch (e) {
                    toast.error("推送服务连接失败，仅启用本地通知");
                    saveReminderSettings({ ...reminderSettings, enabled: true });
                }
            } else if (result === "denied") {
                toast.error("通知权限被拒绝，请在浏览器设置中开启");
            }
        } catch (e) {
            toast.error("请求通知权限失败");
        }
    };

    const toggleReminderEnabled = () => {
        if (!reminderSettings.enabled && notificationPermission !== "granted") {
            requestNotificationPermission();
        } else {
            const newEnabled = !reminderSettings.enabled;
            saveReminderSettings({ ...reminderSettings, enabled: newEnabled });
            if (newEnabled && notificationPermission === "granted") {
                subscribeToPush().catch(console.error);
            }
            toast.success(newEnabled ? "护肤提醒已开启" : "护肤提醒已关闭");
        }
    };

    const showTestNotification = (type: "morning" | "evening") => {
        if (notificationPermission !== "granted") return;

        const title = type === "morning" ? "☀️ 早安护肤提醒" : "🌙 晚间护肤提醒";
        const body = type === "morning"
            ? "开始新的一天！别忘了做好防晒和基础护理 ✨"
            : "辛苦一天了！卸妆清洁后开始你的晚间护理吧 🌸";

        new Notification(title, { body, icon: "/logo-myskin-today.svg" });
    };

    const testNotification = async () => {
        if (notificationPermission !== "granted") {
            requestNotificationPermission();
            return;
        }

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
                showTestNotification("morning");
                toast.success("本地测试通知已发送 (SW未订阅)");
            }
        } catch (e) {
            showTestNotification("morning");
            toast.success("本地测试通知已发送 (Fallback)");
        }
    };

    if (!user && !isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Main Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 10 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        className="relative z-10 w-full max-w-[840px] h-[600px] bg-white rounded-2xl overflow-hidden flex shadow-2xl shadow-black/10 flex-col md:flex-row border border-zinc-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* --- LEFT SIDEBAR (Notion Style) --- */}
                        <div className="w-full md:w-[240px] bg-zinc-50/80 backdrop-blur-sm p-6 flex flex-col flex-shrink-0 border-r border-zinc-200/50">

                            {/* User Profile Summary */}
                            <div className="flex items-center gap-4 px-2 mb-8 mt-4">
                                <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 font-bold text-lg border border-zinc-300/50 overflow-hidden">
                                    {user?.name?.[0]?.toUpperCase() || <UserIcon size={20} />}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-base font-bold text-zinc-900 truncate">
                                        {user?.name}
                                    </span>
                                    <span className="text-[11px] font-bold text-zinc-400 tracking-widest">
                                        {user?.role === 'admin' ? '管理员' : '正式会员'}
                                    </span>
                                </div>
                            </div>

                            {/* Navigation Menu */}
                            <div className="w-full space-y-1 flex-1">
                                <p className="px-3 mb-2 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">个人设置</p>
                                <button
                                    onClick={() => setActiveTab('profile')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'profile'
                                        ? "bg-zinc-200/60 text-zinc-900 font-medium"
                                        : "text-zinc-500 hover:bg-zinc-200/40 hover:text-zinc-900"
                                        }`}
                                >
                                    <User size={16} />
                                    <span>账户资料</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'history'
                                        ? "bg-zinc-200/60 text-zinc-900 font-medium"
                                        : "text-zinc-500 hover:bg-zinc-200/40 hover:text-zinc-900"
                                        }`}
                                >
                                    <LayoutGrid size={16} />
                                    <span>测评记录</span>
                                </button>
                                {notificationPermission !== "unsupported" && (
                                    <button
                                        onClick={() => setActiveTab('reminder')}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'reminder'
                                            ? "bg-zinc-200/60 text-zinc-900 font-medium"
                                            : "text-zinc-500 hover:bg-zinc-200/40 hover:text-zinc-900"
                                            }`}
                                    >
                                        <Bell size={16} />
                                        <span>护肤提醒</span>
                                        {reminderSettings.enabled && (
                                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Bottom Actions */}
                            <div className="pt-4 border-t border-zinc-200/50 mt-auto">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-zinc-500 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-all text-sm"
                                >
                                    <LogOut size={16} />
                                    <span>退出登录</span>
                                </button>
                            </div>
                        </div>

                        {/* --- RIGHT CONTENT AREA --- */}
                        <div className="flex-1 bg-white flex flex-col min-h-0 relative">
                            {/* Header Bar */}
                            <div className="h-14 flex items-center justify-between px-8 border-b border-zinc-100 sticky top-0 bg-white/80 backdrop-blur-md z-20">
                                <h3 className="text-base font-bold text-zinc-900">
                                    {activeTab === 'profile' ? '账户资料' : activeTab === 'history' ? '测评记录' : '护肤提醒'}
                                </h3>
                                <button
                                    onClick={onClose}
                                    className="p-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">

                                {/* PROFILE CONTENT (Apple Style Grouped List) */}
                                {activeTab === 'profile' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="max-w-lg mx-auto space-y-5 h-full flex flex-col justify-center"
                                    >
                                        {/* Avatar Section (Compacted) */}
                                        <div className="flex flex-col items-center py-1">
                                            <div className="w-18 h-18 rounded-full bg-zinc-100 border-4 border-white shadow-sm flex items-center justify-center text-3xl mb-2">
                                                {user?.name?.[0]?.toUpperCase() || "👤"}
                                            </div>
                                            <h4 className="text-lg font-bold text-zinc-900">{user?.name}</h4>
                                            <p className="text-[10px] text-zinc-400 mt-0.5 tracking-widest font-bold">正式会员</p>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Group 1: Identity */}
                                            <div>
                                                <h5 className="px-4 mb-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">个人信息</h5>
                                                <div className="bg-zinc-50/50 rounded-xl border border-zinc-200/60 overflow-hidden">
                                                    {/* Row: Name */}
                                                    <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-zinc-100">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight mb-0.5">昵称</span>
                                                            <input
                                                                type="text"
                                                                value={editName}
                                                                onChange={(e) => setEditName(e.target.value)}
                                                                onBlur={handleSaveProfile}
                                                                className="text-sm font-medium text-zinc-900 bg-transparent outline-none focus:text-blue-600 transition-colors w-full"
                                                                placeholder="设置您的昵称"
                                                            />
                                                        </div>
                                                        {isSaving ? (
                                                            <Loader2 size={14} className="animate-spin text-zinc-400" />
                                                        ) : (
                                                            <ChevronRight size={14} className="text-zinc-300" />
                                                        )}
                                                    </div>

                                                    {/* Row: Phone */}
                                                    <div className="px-4 py-3 flex items-center justify-between bg-white">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight mb-0.5">绑定手机</span>
                                                            <span className="text-sm font-medium text-zinc-900">{user?.phone || "未绑定手机"}</span>
                                                        </div>
                                                        <Smartphone size={16} className="text-zinc-300" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Group 2: Account Level */}
                                            <div>
                                                <h5 className="px-4 mb-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">账户权限</h5>
                                                <div className="bg-zinc-50/50 rounded-xl border border-zinc-200/60 overflow-hidden">
                                                    <div className="px-4 py-3 flex items-center justify-between bg-white">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                                                                <Sparkles size={14} fill="currentColor" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold text-zinc-900">会员等级</span>
                                                                <span className="text-[10px] text-zinc-400 font-medium italic">您已获得正式会员权限</span>
                                                            </div>
                                                        </div>
                                                        <span className="px-2 py-0.5 bg-zinc-100 rounded text-[10px] font-bold text-zinc-600 border border-zinc-200">正式</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* HISTORY CONTENT (Notion Gallery Style) */}
                                {activeTab === 'history' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="h-full"
                                    >
                                        {loadingHistory ? (
                                            <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-3">
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span className="text-[10px] font-bold tracking-widest">加载中...</span>
                                            </div>
                                        ) : auditHistory.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4 border border-zinc-100">
                                                    <Clock className="w-6 h-6 text-zinc-300" />
                                                </div>
                                                <h4 className="text-zinc-900 font-bold mb-1">暂无测评记录</h4>
                                                <p className="text-zinc-400 text-xs mb-6 max-w-[200px]">
                                                    开始您的第一次 AI 皮肤分析，记录您的护肤历程。
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        onClose();
                                                        router.push("/questions");
                                                    }}
                                                    className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors"
                                                >
                                                    立即测速
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4 pb-4">
                                                {auditHistory.map((session, i) => (
                                                    <Link
                                                        href={`/result?id=${session.sessionId}`}
                                                        key={session.sessionId}
                                                        className="group"
                                                    >
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.05 }}
                                                            className="bg-white p-5 rounded-2xl border border-zinc-200 hover:border-zinc-400 hover:shadow-sm transition-all duration-200 h-full flex flex-col gap-3 relative"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-0.5 bg-zinc-50 rounded">
                                                                    {new Date(session.completedAt).toLocaleDateString()}
                                                                </span>
                                                                <div className="text-2xl font-bold tracking-tighter text-zinc-900">
                                                                    {session.analysisResult?.faceAnalysis?.overallScore || '--'}
                                                                    <span className="text-[10px] text-zinc-300 ml-0.5 font-normal">pts</span>
                                                                </div>
                                                            </div>

                                                            <div className="mt-auto">
                                                                <h4 className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">
                                                                    {session.analysisResult?.skinProfile?.typeLabel || "皮肤深度分析"}
                                                                </h4>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                                    <span className="text-[10px] text-zinc-400">已生成详细报告</span>
                                                                </div>
                                                            </div>

                                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <ChevronRight size={14} className="text-zinc-400" />
                                                            </div>
                                                        </motion.div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* REMINDER SETTINGS (iOS Style) */}
                                {activeTab === 'reminder' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="max-w-2xl mx-auto space-y-8"
                                    >
                                        <div className="space-y-6">
                                            {/* Group 1: General Toggle */}
                                            <div>
                                                <h5 className="px-4 mb-2 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">全局设置</h5>
                                                <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                                                    <div className="px-4 py-4 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${reminderSettings.enabled ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                                                <Bell size={16} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold text-zinc-900">开启护肤提醒</span>
                                                                <span className="text-[10px] text-zinc-400 font-medium">在设定的时间通过浏览器通知您</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={toggleReminderEnabled}
                                                            className={`w-11 h-6 rounded-full transition-colors relative duration-200 ease-in-out ${reminderSettings.enabled ? 'bg-[#34C759]' : 'bg-zinc-200'}`}
                                                        >
                                                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${reminderSettings.enabled ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Group 2: Time Settings */}
                                            <div>
                                                <h5 className="px-4 mb-2 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">提醒计划</h5>
                                                <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
                                                    {/* Morning Row */}
                                                    <div className={`px-4 py-4 flex items-center justify-between transition-opacity ${reminderSettings.morningEnabled ? 'opacity-100' : 'opacity-40'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-500 flex items-center justify-center">
                                                                <Sun size={16} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold text-zinc-900">早间护肤</span>
                                                                <input
                                                                    type="time"
                                                                    value={reminderSettings.morningTime}
                                                                    onChange={(e) => saveReminderSettings({ ...reminderSettings, morningTime: e.target.value })}
                                                                    className="text-sm font-bold text-blue-600 bg-transparent outline-none p-0 cursor-pointer"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => saveReminderSettings({ ...reminderSettings, morningEnabled: !reminderSettings.morningEnabled })}
                                                            className={`w-11 h-6 rounded-full transition-colors relative duration-200 ease-in-out ${reminderSettings.morningEnabled ? 'bg-[#34C759]' : 'bg-zinc-200'}`}
                                                        >
                                                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${reminderSettings.morningEnabled ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                                                        </button>
                                                    </div>

                                                    {/* Evening Row */}
                                                    <div className={`px-4 py-4 flex items-center justify-between transition-opacity ${reminderSettings.eveningEnabled ? 'opacity-100' : 'opacity-40'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                                                <Moon size={16} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold text-zinc-900">晚间护肤</span>
                                                                <input
                                                                    type="time"
                                                                    value={reminderSettings.eveningTime}
                                                                    onChange={(e) => saveReminderSettings({ ...reminderSettings, eveningTime: e.target.value })}
                                                                    className="text-sm font-bold text-blue-600 bg-transparent outline-none p-0 cursor-pointer"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => saveReminderSettings({ ...reminderSettings, eveningEnabled: !reminderSettings.eveningEnabled })}
                                                            className={`w-11 h-6 rounded-full transition-colors relative duration-200 ease-in-out ${reminderSettings.eveningEnabled ? 'bg-[#34C759]' : 'bg-zinc-200'}`}
                                                        >
                                                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${reminderSettings.eveningEnabled ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Test Section */}
                                            <div className="flex flex-col items-center gap-4 py-4">
                                                <button
                                                    onClick={testNotification}
                                                    className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                                                >
                                                    发送测试通知
                                                </button>
                                                <p className="text-[10px] text-zinc-400 max-w-[260px] text-center italic">
                                                    如果无法收到通知，请检查浏览器地址栏左侧的“权限设置”是否已允许通知权限。
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
