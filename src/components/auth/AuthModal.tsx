"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Eye, EyeOff, ArrowRight, ArrowLeft, Phone, CheckCircle } from "lucide-react";

export function AuthModal() {
    const { isOpen, view, openAuthModal, closeAuthModal, setAuthView } = useAuthModal();
    const { login, register } = useAuth();
    const toast = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        if (searchParams.get("login") === "wechat_bind") {
            openAuthModal("wechat_bind");
            // Remove the param so it doesn't trigger again on reload
            router.replace(window.location.pathname, { scroll: false });
        }
    }, [searchParams, openAuthModal, router]);

    // Form States
    const [loading, setLoading] = useState(false);

    // Login Fields
    const [loginPhone, setLoginPhone] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // Register Fields
    const [regName, setRegName] = useState("");
    const [regPhone, setRegPhone] = useState("");
    const [regCode, setRegCode] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regCodeSending, setRegCodeSending] = useState(false);
    const [regCountdown, setRegCountdown] = useState(0);

    // Forgot Password Fields
    const [forgotPhone, setForgotPhone] = useState("");
    const [forgotSubmitted, setForgotSubmitted] = useState(false);
    const [resetCode, setResetCode] = useState("");
    const [resetNewPassword, setResetNewPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);

    // Reset states when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            setForgotSubmitted(false);
            setRegCodeSending(false);
            setRegCountdown(0);
        }
    }, [isOpen]);

    // Cleanup interval for countdown
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (regCountdown > 0) {
            timer = setTimeout(() => setRegCountdown(prev => prev - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [regCountdown]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            console.log("🔐 Starting login request...");
            await login({ phone: loginPhone, password: loginPassword });
            console.log("✅ Login successful, closing modal...");
            toast.success("欢迎回来！");
            closeAuthModal();
        } catch (err: any) {
            console.error("🔴 Login failed:", err.message);
            toast.error(err.message || "登录失败，请检查账号密码");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register({ name: regName, phone: regPhone, code: regCode, password: regPassword });
            toast.success("注册成功！");
            closeAuthModal();
        } catch (err: any) {
            toast.error(err.message || "注册失败，请稍后重试");
        } finally {
            setLoading(false);
        }
    };

    const handleWechatBind = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/auth/wechat/bind", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: regPhone, code: regCode, password: regPassword })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "绑定失败");

            toast.success("绑定成功！");

            // Re-fetch user session to update state globally
            window.location.href = "/"; // Reload to refresh contexts naturally, or call context.refresh() 
            // We use standard reload to make sure everything initializes fresh with the new token
        } catch (err: any) {
            toast.error(err.message || "绑定失败，请稍后重试");
            setLoading(false);
        }
    };

    const handleWechatLogin = async () => {
        setLoading(true);
        try {
            // Include full origin to make sure redirect works across domains
            const currentUrl = window.location.origin + window.location.pathname + window.location.search;
            const res = await fetch(`/api/auth/wechat?redirect=${encodeURIComponent(currentUrl)}`);
            const data = await res.json();
            if (data.success) {
                window.location.href = data.data.authUrl;
            } else {
                toast.error(data.error?.message || "获取微信授权失败");
            }
        } catch {
            toast.error("网络错误，请重试");
        } finally {
            setLoading(false);
        }
    };

    const handleSendRegCode = async () => {
        if (!/^1[3-9]\d{9}$/.test(regPhone)) {
            toast.error("请输入正确的手机号");
            return;
        }
        setRegCodeSending(true);
        try {
            const res = await fetch("/api/auth/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: regPhone, type: "register" })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || data.error || "发送验证码失败");
            toast.success("验证码已发送");
            setRegCountdown(60);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setRegCodeSending(false);
        }
    };

    const handleSendResetLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/auth/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: forgotPhone, type: "reset" })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error?.message || data.error || "请求失败");

            setForgotSubmitted(true);
            toast.success("重置验证码已发送");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        setAuthView("forgot_password");
        setForgotSubmitted(false);
        setResetCode("");
        setResetNewPassword("");
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: forgotPhone, code: resetCode, password: resetNewPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || data.error || "重置失败");

            toast.success("密码已重置，请登录");
            setAuthView("login");
            setLoginPhone(forgotPhone);
            // reset form data
            setResetCode("");
            setResetNewPassword("");
            setForgotSubmitted(false);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    let headerTitle = "NIHPLOD";
    let headerSubtitle = "";

    if (view === "login") {
        headerSubtitle = "账户登录";
    } else if (view === "register") {
        headerSubtitle = "注册会员";
    } else if (view === "forgot_password") {
        headerTitle = "找回密码";
        headerSubtitle = "安全重置";
    } else if (view === "wechat_bind") {
        headerTitle = "绑定手机号";
        headerSubtitle = "微信授权成功，请绑定手机";
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    {/* Backdrop with Blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeAuthModal}
                        className="absolute inset-0 bg-[#1A1A1A]/20 backdrop-blur-[8px]"
                    />

                    {/* Modal Content - Premium Design */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="relative z-10 w-full max-w-[400px] bg-[#FDFBF7]/95 backdrop-blur-xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[92vh]"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={closeAuthModal}
                            disabled={loading}
                            className="absolute top-5 right-5 z-20 p-2 rounded-full text-[#1A1A1A]/40 hover:text-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-all"
                        >
                            <X size={20} />
                        </button>

                        {/* Back Button (Only for register/forgot) */}
                        {view !== 'login' && (
                            <button
                                onClick={() => setAuthView('login')}
                                disabled={loading}
                                className="absolute top-5 left-5 z-20 p-2 rounded-full text-[#1A1A1A]/40 hover:text-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-all flex items-center gap-1"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}

                        <div className="overflow-y-auto p-6 sm:p-8 pt-8 sm:pt-10">
                            {/* Header */}
                            <div className="text-center mb-8">
                                {view !== 'forgot_password' && view !== 'wechat_bind' ? (
                                    <div className="mb-3 flex justify-center">
                                        <img
                                            src="/NIHPLOD-logo.svg"
                                            alt="NIHPLOD"
                                            className="h-7 sm:h-8.5 object-contain opacity-90"
                                        />
                                    </div>
                                ) : (
                                    <h1 className="font-serif text-2xl text-[#1A1A1A] mb-3 tracking-wide">
                                        {headerTitle}
                                    </h1>
                                )}
                                <p className="text-[#8C8C8C] text-xs font-medium tracking-widest uppercase">
                                    {headerSubtitle}
                                </p>
                            </div>

                            {/* Forms */}
                            {view === "login" && (
                                <form onSubmit={handleLogin} className="space-y-4">
                                    {/* Phone */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">手机号</label>
                                        <input
                                            type="tel"
                                            required
                                            value={loginPhone}
                                            onChange={(e) => setLoginPhone(e.target.value)}
                                            className="w-full px-4 py-3 sm:py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all font-medium"
                                            placeholder="请输入手机号"
                                        />
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center ml-1">
                                            <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider">密码</label>
                                            <button
                                                type="button"
                                                onClick={handleForgotPassword}
                                                className="text-xs text-[#8C8C8C] hover:text-[#1A1A1A] transition-colors"
                                            >
                                                忘记密码？
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                value={loginPassword}
                                                onChange={(e) => setLoginPassword(e.target.value)}
                                                className="w-full px-4 py-3 sm:py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all pr-12 font-medium"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full mt-4 sm:mt-6 glass-premium-primary rounded-full py-[11px] sm:py-3.5 text-[14px] sm:text-[15px] font-medium tracking-[0.15em] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>登录账户 <ArrowRight className="w-4 h-4" /></>}
                                    </button>

                                    {/* Social Login Separator */}
                                    <div className="relative my-7 sm:my-8">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-[#E6E2D6]"></div>
                                        </div>
                                        <div className="relative flex justify-center text-xs">
                                            <span className="px-4 bg-[#FDFBF7] text-[#8C8C8C] font-medium uppercase tracking-wider">其他登录方式</span>
                                        </div>
                                    </div>

                                    {/* Wechat Login Button */}
                                    <button
                                        type="button"
                                        onClick={handleWechatLogin}
                                        disabled={loading}
                                        className="w-fit mx-auto px-10 py-2.5 sm:py-3 border border-[#E6E2D6] rounded-full text-[13px] sm:text-[14px] font-medium tracking-widest flex items-center justify-center gap-2.5 transition-all hover:bg-white hover:border-[#1A1A1A]/20 active:scale-[0.95] disabled:opacity-50"
                                    >
                                        <svg className="w-4 h-4 text-[#07C160]" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088-.182-.013-.373-.027-.545-.035h-.06zm-2.89 3.217c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" />
                                        </svg>
                                        <span className="text-[#1A1A1A]/60 font-medium">微信账号快速登录</span>
                                    </button>
                                </form>
                            )}

                            {view === "register" && (
                                <form onSubmit={handleRegister} className="space-y-4">
                                    {/* Name */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">姓名</label>
                                        <input
                                            type="text"
                                            required
                                            value={regName}
                                            onChange={(e) => setRegName(e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all font-medium"
                                            placeholder="Your Name"
                                        />
                                    </div>

                                    {/* Phone */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">手机号</label>
                                        <input
                                            type="tel"
                                            required
                                            value={regPhone}
                                            onChange={(e) => setRegPhone(e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all font-medium"
                                            placeholder="请输入手机号"
                                        />
                                    </div>

                                    {/* Verify Code */}
                                    <div className="space-y-1.5 flex gap-2">
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">验证码</label>
                                            <input
                                                type="text"
                                                required
                                                maxLength={6}
                                                value={regCode}
                                                onChange={(e) => setRegCode(e.target.value)}
                                                className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all font-medium"
                                                placeholder="6位验证码"
                                            />
                                        </div>
                                        <div className="pt-6">
                                            <button
                                                type="button"
                                                onClick={handleSendRegCode}
                                                disabled={regCodeSending || regCountdown > 0 || !regPhone}
                                                className="px-4 py-3.5 h-full rounded-2xl bg-[#E6E2D6]/50 text-[#5C5855] text-sm font-semibold hover:bg-[#E6E2D6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                                            >
                                                {regCountdown > 0 ? `${regCountdown}s` : "获取"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">密码</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                minLength={6}
                                                value={regPassword}
                                                onChange={(e) => setRegPassword(e.target.value)}
                                                className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all pr-12 font-medium"
                                                placeholder="至少6位字符"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full mt-4 sm:mt-6 glass-premium-primary rounded-full py-[11px] sm:py-4 text-[14px] sm:text-[15px] font-medium tracking-[0.15em] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>创建账户 <ArrowRight className="w-4 h-4" /></>}
                                    </button>
                                </form>
                            )}

                            {view === "wechat_bind" && (
                                <form onSubmit={handleWechatBind} className="space-y-4">
                                    <p className="text-center text-[#8C8C8C] text-sm mb-4">
                                        为了保障您的账户安全与多端同步体验，请绑定并在日后使用此手机号登录。
                                    </p>

                                    {/* Phone */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">手机号</label>
                                        <input
                                            type="tel"
                                            required
                                            value={regPhone}
                                            onChange={(e) => setRegPhone(e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all font-medium"
                                            placeholder="请输入绑定的真实手机号"
                                        />
                                    </div>

                                    {/* Verify Code */}
                                    <div className="space-y-1.5 flex gap-2">
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">验证码</label>
                                            <input
                                                type="text"
                                                required
                                                maxLength={6}
                                                value={regCode}
                                                onChange={(e) => setRegCode(e.target.value)}
                                                className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all font-medium"
                                                placeholder="6位验证码"
                                            />
                                        </div>
                                        <div className="pt-6">
                                            <button
                                                type="button"
                                                onClick={handleSendRegCode}
                                                disabled={regCodeSending || regCountdown > 0 || !regPhone}
                                                className="px-4 py-3.5 h-full rounded-2xl bg-[#E6E2D6]/50 text-[#5C5855] text-sm font-semibold hover:bg-[#E6E2D6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                                            >
                                                {regCountdown > 0 ? `${regCountdown}s` : "获取"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">设置密码</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                minLength={6}
                                                value={regPassword}
                                                onChange={(e) => setRegPassword(e.target.value)}
                                                className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all pr-12 font-medium"
                                                placeholder="至少6位密码，用于后续直接登录"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full mt-4 sm:mt-6 glass-premium-primary rounded-full py-[11px] sm:py-3.5 text-[14px] sm:text-[15px] font-medium tracking-[0.15em] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>绑定手机号并完成 <CheckCircle className="w-4 h-4" /></>}
                                    </button>
                                </form>
                            )}

                            {view === "forgot_password" && (
                                <div>
                                    {forgotSubmitted ? (
                                        <form onSubmit={handleResetPassword} className="space-y-4">
                                            <div className="text-center py-2 mb-2">
                                                <h3 className="text-lg font-medium text-[#1A1A1A] mb-1">验证码已发送至 {forgotPhone}</h3>
                                                <button
                                                    type="button"
                                                    onClick={handleSendResetLink}
                                                    disabled={loading}
                                                    className="text-[#C9A86C] text-xs font-medium hover:underline disabled:opacity-50"
                                                >
                                                    重新发送验证码
                                                </button>
                                            </div>

                                            {/* Code Input */}
                                            <div className="space-y-1.5 flex gap-2">
                                                <div className="flex-1 space-y-1.5">
                                                    <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">验证码</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        maxLength={6}
                                                        value={resetCode}
                                                        onChange={(e) => setResetCode(e.target.value)}
                                                        className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all font-medium"
                                                        placeholder="6位验证码"
                                                    />
                                                </div>
                                            </div>

                                            {/* New Password Input */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">新密码</label>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        required
                                                        minLength={6}
                                                        value={resetNewPassword}
                                                        onChange={(e) => setResetNewPassword(e.target.value)}
                                                        className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all pr-12 font-medium"
                                                        placeholder="至少6位新密码"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#1A1A1A] transition-colors"
                                                    >
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full mt-4 sm:mt-6 glass-premium-primary rounded-full py-[11px] sm:py-3.5 text-[14px] sm:text-[15px] font-medium tracking-[0.15em] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "完成重置"}
                                            </button>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleSendResetLink} className="space-y-4">
                                            <p className="text-[#8C8C8C] text-sm mb-4">
                                                请输入您的注册手机号，我们将向您发送重置密码的验证码。
                                            </p>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-[#5C5855] uppercase tracking-wider ml-1">手机号</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-3.5 text-[#1A1A1A]/30 w-5 h-5" />
                                                    <input
                                                        type="tel"
                                                        required
                                                        value={forgotPhone}
                                                        onChange={(e) => setForgotPhone(e.target.value)}
                                                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all font-medium"
                                                        placeholder="请输入手机号"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full mt-4 sm:mt-6 glass-premium-primary rounded-full py-[11px] sm:py-3.5 text-[14px] sm:text-[15px] font-medium tracking-[0.15em] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "发送验证码"}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* View Switcher Footer */}
                        {view !== 'forgot_password' && view !== 'wechat_bind' && (
                            <div className="p-6 text-center border-t border-[#E6E2D6]/50 bg-white/30 backdrop-blur-sm">
                                {view === "login" ? (
                                    <p className="text-[#8C8C8C] text-sm">
                                        还没有账号？{" "}
                                        <button
                                            onClick={() => setAuthView("register")}
                                            className="text-[#C9A86C] font-semibold hover:underline hover:text-[#B08D55] transition-colors"
                                        >
                                            立即注册
                                        </button>
                                    </p>
                                ) : (
                                    <p className="text-[#8C8C8C] text-sm">
                                        已有账号？{" "}
                                        <button
                                            onClick={() => setAuthView("login")}
                                            className="text-[#1A1A1A] font-semibold hover:underline transition-colors"
                                        >
                                            立即登录
                                        </button>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Footer for Forgot Password */}
                        {view === 'forgot_password' && (
                            <div className="p-6 text-center border-t border-[#E6E2D6]/50 bg-white/30 backdrop-blur-sm">
                                <button
                                    onClick={() => setAuthView("login")}
                                    className="text-[#1A1A1A] font-medium hover:underline transition-colors text-sm"
                                >
                                    返回登录
                                </button>
                            </div>
                        )}

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
