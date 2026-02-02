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

        try {
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
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

                    {/* Horizontal Dashboard Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
                        className="relative z-10 w-full max-w-[900px] h-auto min-h-[600px] max-h-[90vh] bg-white rounded-3xl overflow-hidden flex shadow-2xl shadow-[#3D4430]/10 flex-col md:flex-row border border-[#E6E2D6]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* --- LEFT SIDEBAR (Light/Beige) --- */}
                        <div className="w-full md:w-[280px] bg-[#F5F2EA] text-[#3D4430] p-8 flex flex-col items-center flex-shrink-0 relative border-r border-[#E6E2D6]/50">

                            {/* Avatar Area */}
                            <div className="mt-8 mb-4 relative">
                                <div className="w-24 h-24 rounded-full bg-white border border-[#E6E2D6] flex items-center justify-center text-3xl font-serif text-[#3D4430] shadow-sm">
                                    {user?.name?.[0]?.toUpperCase() || <UserIcon size={32} />}
                                </div>
                                <div className="absolute bottom-0 right-0 bg-[#C9A86C] text-white p-1.5 rounded-full border-2 border-[#F5F2EA]">
                                    <Sparkles size={12} fill="currentColor" />
                                </div>
                            </div>

                            <h2 className="text-xl font-serif tracking-wide text-center px-2 truncate w-full text-[#3D4430] mt-2">
                                {user?.name}
                            </h2>
                            <p className="text-xs uppercase tracking-[0.25em] text-[#8C8C8C] mt-2 mb-10 font-medium">
                                {user?.role === 'admin' ? '管理员' : '正式会员'}
                            </p>

                            {/* Navigation Menu */}
                            <div className="w-full space-y-2 flex-1">
                                <button
                                    onClick={() => setActiveTab('profile')}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold tracking-wider uppercase transition-all ${activeTab === 'profile'
                                        ? "bg-white text-[#3D4430] shadow-sm ring-1 ring-[#E6E2D6] translate-x-1"
                                        : "text-[#8C8C8C] hover:text-[#3D4430] hover:bg-white/50 hover:translate-x-1"
                                        }`}
                                >
                                    <User size={16} />
                                    <span>我的资料</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold tracking-wider uppercase transition-all ${activeTab === 'history'
                                        ? "bg-white text-[#3D4430] shadow-sm ring-1 ring-[#E6E2D6] translate-x-1"
                                        : "text-[#8C8C8C] hover:text-[#3D4430] hover:bg-white/50 hover:translate-x-1"
                                        }`}
                                >
                                    <LayoutGrid size={16} />
                                    <span>历史记录</span>
                                </button>
                                {notificationPermission !== "unsupported" && (
                                    <button
                                        onClick={() => setActiveTab('reminder')}
                                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold tracking-wider uppercase transition-all ${activeTab === 'reminder'
                                            ? "bg-white text-[#3D4430] shadow-sm ring-1 ring-[#E6E2D6] translate-x-1"
                                            : "text-[#8C8C8C] hover:text-[#3D4430] hover:bg-white/50 hover:translate-x-1"
                                            }`}
                                    >
                                        <Bell size={16} />
                                        <span>护肤提醒</span>
                                        {reminderSettings.enabled && (
                                            <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Logout at Bottom */}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-[#8C8C8C] hover:text-red-500 hover:bg-red-50 rounded-xl transition-all text-sm font-medium mt-auto hover:translate-x-1"
                            >
                                <LogOut size={16} />
                                <span>退出登录</span>
                            </button>
                        </div>

                        {/* --- RIGHT CONTENT (Light) --- */}
                        <div className="flex-1 bg-[#FDFBF7] flex flex-col relative min-h-0">

                            {/* Header Bar */}
                            <div className="h-16 border-b border-[#E6E2D6] flex items-center justify-between px-8 bg-white/50 backdrop-blur-sm sticky top-0 z-20">
                                <h3 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-widest flex items-center gap-2">
                                    {activeTab === 'profile' ? (
                                        <>个人资料</>
                                    ) : activeTab === 'history' ? (
                                        <>测评记录</>
                                    ) : (
                                        <>护肤提醒设置</>
                                    )}
                                </h3>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#1A1A1A]/20 hover:text-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">

                                {/* PROFILE CONTENT */}
                                {activeTab === 'profile' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="max-w-lg space-y-8"
                                    >
                                        {/* Name Input */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <label className="text-xs font-bold text-[#8C8C8C] uppercase tracking-wider">
                                                    昵称
                                                </label>
                                                {isSaving && <span className="text-xs text-[#C9A86C] flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> 保存中</span>}
                                            </div>
                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onBlur={handleSaveProfile}
                                                    className="w-full bg-[#FAF9F6] border border-[#E6E2D6] rounded-xl px-6 py-4 text-[#1A1A1A] font-medium transition-all focus:border-[#C9A86C] focus:ring-4 focus:ring-[#C9A86C]/5 outline-none text-lg"
                                                    placeholder="请输入您的昵称"
                                                />
                                            </div>
                                            <p className="text-xs text-[#8C8C8C]/80">
                                                这是一个公开显示的名称，您可以随时更改。
                                            </p>
                                        </div>

                                        {/* Info Grid */}
                                        <div className="grid grid-cols-2 gap-4 pt-4">
                                            <div className="bg-[#FAF9F6] p-5 rounded-xl border border-[#E6E2D6] space-y-2 hover:border-[#C9A86C]/30 transition-colors">
                                                <div className="text-xs font-bold text-[#8C8C8C] uppercase tracking-wider mb-2">
                                                    绑定手机
                                                </div>
                                                <div className="flex items-center gap-2 text-[#1A1A1A] font-medium">
                                                    <Smartphone size={16} className="text-[#C9A86C]" />
                                                    <span className="truncate">{user?.phone || "暂无手机号"}</span>
                                                </div>
                                            </div>

                                            <div className="bg-[#FAF9F6] p-5 rounded-xl border border-[#E6E2D6] space-y-2 hover:border-[#C9A86C]/30 transition-colors">
                                                <div className="text-xs font-bold text-[#8C8C8C] uppercase tracking-wider mb-2">
                                                    当前身份
                                                </div>
                                                <div className="flex items-center gap-2 text-[#1A1A1A] font-medium">
                                                    <Sparkles size={16} className="text-[#C9A86C]" />
                                                    <span>{user?.role === 'admin' ? '管理员' : '正式会员'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* HISTORY CONTENT (GRID LAYOUT) */}
                                {activeTab === 'history' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="h-full"
                                    >
                                        {loadingHistory ? (
                                            <div className="h-full flex flex-col items-center justify-center text-[#1A1A1A]/20 gap-3">
                                                <Loader2 className="w-8 h-8 animate-spin" />
                                                <span className="text-xs font-medium uppercase tracking-widest">加载中...</span>
                                            </div>
                                        ) : auditHistory.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                                <div className="w-20 h-20 bg-[#FDFBF7] rounded-full flex items-center justify-center mb-6 shadow-sm border border-[#E6E2D6]">
                                                    <Clock className="w-8 h-8 text-[#1A1A1A]/10" />
                                                </div>
                                                <h4 className="text-[#1A1A1A] font-serif text-lg mb-2">暂无记录</h4>
                                                <p className="text-[#8C8C8C] text-sm max-w-[200px] mb-8">
                                                    您还没有进行过皮肤测评。开始您的第一次分析吧。
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        onClose();
                                                        router.push("/questions");
                                                    }}
                                                    className="px-8 py-3 bg-[#1A1A1A] text-white rounded-xl text-xs font-bold tracking-widest uppercase hover:bg-[#333] transition-colors"
                                                >
                                                    开始测评
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
                                                {auditHistory.map((session, i) => (
                                                    <Link
                                                        href={`/result?id=${session.sessionId}`}
                                                        key={session.sessionId}
                                                        className="group"
                                                    >
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            transition={{ delay: i * 0.05 }}
                                                            className="bg-white p-5 rounded-2xl border border-[#E6E2D6] hover:border-[#C9A86C]/50 hover:shadow-xl hover:shadow-[#C9A86C]/5 transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between group-hover:-translate-y-1"
                                                        >
                                                            {/* Top Info */}
                                                            <div>
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#8C8C8C] uppercase tracking-wider bg-[#F5F5F5] px-2 py-1 rounded-md group-hover:bg-[#C9A86C]/10 group-hover:text-[#C9A86C] transition-colors">
                                                                        <Calendar size={10} />
                                                                        {new Date(session.completedAt).toLocaleDateString()}
                                                                    </div>
                                                                    <div className={`text-lg font-bold font-serif ${session.analysisResult?.faceAnalysis?.overallScore >= 80 ? 'text-green-600' :
                                                                        session.analysisResult?.faceAnalysis?.overallScore >= 60 ? 'text-[#C9A86C]' : 'text-red-500'
                                                                        }`}>
                                                                        {session.analysisResult?.faceAnalysis?.overallScore}
                                                                        <span className="text-xs font-sans font-normal text-[#1A1A1A]/20 ml-0.5">分</span>
                                                                    </div>
                                                                </div>

                                                                <h4 className="text-base font-bold text-[#1A1A1A] mb-1">
                                                                    {session.analysisResult?.skinProfile?.typeLabel || "肤质类型"}
                                                                </h4>
                                                                <p className="text-xs text-[#8C8C8C] line-clamp-1">
                                                                    点击查看详细分析报告...
                                                                </p>
                                                            </div>

                                                            {/* Bottom Action */}
                                                            <div className="mt-4 pt-4 border-t border-[#F5F5F5] flex justify-between items-center">
                                                                <span className="text-xs text-[#1A1A1A]/30 font-medium">
                                                                    {new Date(session.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                <div className="w-6 h-6 rounded-full bg-[#F5F5F5] flex items-center justify-center text-[#1A1A1A]/20 group-hover:bg-[#1A1A1A] group-hover:text-white transition-all">
                                                                    <ChevronRight size={14} />
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* REMINDER SETTINGS CONTENT */}
                                {activeTab === 'reminder' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="max-w-lg space-y-6"
                                    >
                                        {/* Enable Toggle */}
                                        <div className="flex items-center justify-between p-5 bg-[#FAF9F6] rounded-xl border border-[#E6E2D6]">
                                            <div className="flex items-center gap-3">
                                                {reminderSettings.enabled ? (
                                                    <div className="w-10 h-10 rounded-full bg-[#3D4430]/10 flex items-center justify-center">
                                                        <Bell className="w-5 h-5 text-[#3D4430]" />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-[#1A1A1A]/5 flex items-center justify-center">
                                                        <BellOff className="w-5 h-5 text-[#1A1A1A]/40" />
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-sm font-bold text-[#1A1A1A]">开启提醒</span>
                                                    <p className="text-xs text-[#8C8C8C] mt-0.5">
                                                        {reminderSettings.enabled ? "提醒已开启" : "提醒已关闭"}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={toggleReminderEnabled}
                                                className={`w-12 h-6 rounded-full transition-all relative ${reminderSettings.enabled ? "bg-[#3D4430]" : "bg-[#1A1A1A]/20"
                                                    }`}
                                            >
                                                <span
                                                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${reminderSettings.enabled ? "translate-x-7" : "translate-x-1"
                                                        }`}
                                                />
                                            </button>
                                        </div>

                                        {/* Time Settings */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-[#8C8C8C] uppercase tracking-wider">
                                                提醒时间
                                            </h4>

                                            {/* Morning */}
                                            <div className={`p-5 rounded-xl border transition-all ${reminderSettings.morningEnabled
                                                ? "border-[#E6E2D6] bg-[#FAF9F6]"
                                                : "border-[#E6E2D6]/50 bg-[#FAF9F6]/50 opacity-60"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                                            <Sun className="w-4 h-4 text-amber-500" />
                                                        </div>
                                                        <span className="font-medium text-[#1A1A1A]">早间提醒</span>
                                                    </div>
                                                    <button
                                                        onClick={() => saveReminderSettings({ ...reminderSettings, morningEnabled: !reminderSettings.morningEnabled })}
                                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${reminderSettings.morningEnabled
                                                            ? "bg-[#3D4430] border-[#3D4430] text-white"
                                                            : "border-[#1A1A1A]/20"
                                                            }`}
                                                    >
                                                        {reminderSettings.morningEnabled && <Check className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                                <input
                                                    type="time"
                                                    value={reminderSettings.morningTime}
                                                    onChange={(e) => saveReminderSettings({ ...reminderSettings, morningTime: e.target.value })}
                                                    disabled={!reminderSettings.morningEnabled}
                                                    className="w-full px-4 py-3 text-sm border border-[#E6E2D6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3D4430]/20 focus:border-[#3D4430] disabled:opacity-50 bg-white"
                                                />
                                            </div>

                                            {/* Evening */}
                                            <div className={`p-5 rounded-xl border transition-all ${reminderSettings.eveningEnabled
                                                ? "border-[#E6E2D6] bg-[#FAF9F6]"
                                                : "border-[#E6E2D6]/50 bg-[#FAF9F6]/50 opacity-60"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                                            <Moon className="w-4 h-4 text-indigo-500" />
                                                        </div>
                                                        <span className="font-medium text-[#1A1A1A]">晚间提醒</span>
                                                    </div>
                                                    <button
                                                        onClick={() => saveReminderSettings({ ...reminderSettings, eveningEnabled: !reminderSettings.eveningEnabled })}
                                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${reminderSettings.eveningEnabled
                                                            ? "bg-[#3D4430] border-[#3D4430] text-white"
                                                            : "border-[#1A1A1A]/20"
                                                            }`}
                                                    >
                                                        {reminderSettings.eveningEnabled && <Check className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                                <input
                                                    type="time"
                                                    value={reminderSettings.eveningTime}
                                                    onChange={(e) => saveReminderSettings({ ...reminderSettings, eveningTime: e.target.value })}
                                                    disabled={!reminderSettings.eveningEnabled}
                                                    className="w-full px-4 py-3 text-sm border border-[#E6E2D6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3D4430]/20 focus:border-[#3D4430] disabled:opacity-50 bg-white"
                                                />
                                            </div>
                                        </div>

                                        {/* Test Button */}
                                        <button
                                            onClick={testNotification}
                                            className="w-full px-6 py-4 text-sm font-bold text-[#3D4430] bg-[#3D4430]/10 rounded-xl hover:bg-[#3D4430]/20 transition-colors"
                                        >
                                            发送测试通知
                                        </button>

                                        {notificationPermission === "denied" && (
                                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                                                <p className="text-sm text-red-600 text-center">
                                                    通知权限被拒绝，请在浏览器设置中开启
                                                </p>
                                            </div>
                                        )}

                                        <p className="text-xs text-[#8C8C8C] text-center pt-4">
                                            提醒会在设定时间通过浏览器通知发送给您
                                        </p>
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
