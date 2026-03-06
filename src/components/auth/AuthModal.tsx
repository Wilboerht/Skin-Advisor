"use client";

import { useState, useEffect } from "react";
import { useAuthModal } from "./AuthModalContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Eye, EyeOff, ArrowRight, ArrowLeft, Phone, CheckCircle } from "lucide-react";

export function AuthModal() {
    const { isOpen, view, closeAuthModal, setAuthView } = useAuthModal();
    const { login, register } = useAuth();
    const toast = useToast();

    // Form States
    const [loading, setLoading] = useState(false);

    // Login Fields
    const [loginPhone, setLoginPhone] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // Register Fields
    const [regName, setRegName] = useState("");
    const [regPhone, setRegPhone] = useState("");
    const [regPassword, setRegPassword] = useState("");

    // Forgot Password Fields
    const [forgotPhone, setForgotPhone] = useState("");
    const [forgotSubmitted, setForgotSubmitted] = useState(false);

    const [showPassword, setShowPassword] = useState(false);

    // Reset states when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            setForgotSubmitted(false);
            // Optionally clear inputs
        }
    }, [isOpen]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login({ phone: loginPhone, password: loginPassword });
            toast.success("欢迎回来！");
            closeAuthModal();
        } catch (err: any) {
            toast.error(err.message || "登录失败，请检查账号密码");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register({ name: regName, phone: regPhone, password: regPassword });
            toast.success("注册成功！");
            closeAuthModal();
        } catch (err: any) {
            toast.error(err.message || "注册失败，请稍后重试");
        } finally {
            setLoading(false);
        }
    };

    const handleSendResetLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: forgotPhone })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "请求失败");

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
                        className="relative z-10 w-full max-w-[400px] bg-[#FDFBF7]/95 backdrop-blur-xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col max-h-[90vh]"
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

                        <div className="overflow-y-auto p-8 pt-10 px-8">
                            {/* Header */}
                            <div className="text-center mb-8">
                                {view !== 'forgot_password' ? (
                                    <div className="mb-3 flex justify-center">
                                        <img
                                            src="/NIHPLOD-logo.svg"
                                            alt="NIHPLOD"
                                            className="h-8.5 object-contain opacity-90"
                                        />
                                    </div>
                                ) : (
                                    <h1 className="font-serif text-2xl text-[#1A1A1A] mb-3 tracking-wide">
                                        找回密码
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
                                            className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all font-medium"
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
                                                className="w-full px-4 py-3.5 rounded-2xl border border-[#E6E2D6] bg-white/70 text-[#1A1A1A] placeholder:text-[#1A1A1A]/20 focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 focus:border-[#1A1A1A]/30 transition-all pr-12 font-medium"
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
                                        className="w-full mt-4 bg-[#1A1A1A] text-[#FDFBF7] rounded-2xl py-4 font-semibold tracking-wide hover:bg-[#2C2C2C] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-[#1A1A1A]/10"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>登录账户 <ArrowRight className="w-4 h-4" /></>}
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
                                        className="w-full mt-4 bg-[#C9A86C] text-white rounded-2xl py-4 font-semibold tracking-wide hover:bg-[#B08D55] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-[#C9A86C]/20"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>创建账户 <ArrowRight className="w-4 h-4" /></>}
                                    </button>
                                </form>
                            )}

                            {view === "forgot_password" && (
                                <div>
                                    {forgotSubmitted ? (
                                        <div className="text-center py-4">
                                            <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                                                <CheckCircle className="w-8 h-8 text-green-500" />
                                            </div>
                                            <h3 className="text-lg font-medium text-[#1A1A1A] mb-2">验证码已发送</h3>
                                            <p className="text-[#8C8C8C] text-sm mb-6">
                                                我们已向 <strong>{forgotPhone}</strong> 发送了验证码。<br />
                                                请查收短信。
                                            </p>
                                            <button
                                                onClick={() => setForgotSubmitted(false)}
                                                className="text-[#C9A86C] text-sm font-medium hover:underline"
                                            >
                                                重新发送
                                            </button>
                                        </div>
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
                                                className="w-full mt-4 bg-[#1A1A1A] text-[#FDFBF7] rounded-2xl py-4 font-semibold tracking-wide hover:bg-[#2C2C2C] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-[#1A1A1A]/10"
                                            >
                                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "发送验证码"}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* View Switcher Footer */}
                        {view !== 'forgot_password' && (
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
