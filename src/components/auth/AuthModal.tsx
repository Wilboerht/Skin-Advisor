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
    const [regConfirmPassword, setRegConfirmPassword] = useState("");
    const [regCodeSending, setRegCodeSending] = useState(false);
    const [regCountdown, setRegCountdown] = useState(0);

    // Forgot Password Fields
    const [forgotPhone, setForgotPhone] = useState("");
    const [forgotSubmitted, setForgotSubmitted] = useState(false);
    const [resetCode, setResetCode] = useState("");
    const [resetNewPassword, setResetNewPassword] = useState("");
    const [resetConfirmPassword, setResetConfirmPassword] = useState("");
    const [resetCountdown, setResetCountdown] = useState(0);

    const [showPassword, setShowPassword] = useState(false);

    // Reset states when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            setForgotSubmitted(false);
            setRegCodeSending(false);
            setRegCountdown(0);
            setResetCountdown(0);
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

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (resetCountdown > 0) {
            timer = setTimeout(() => setResetCountdown(prev => prev - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [resetCountdown]);

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
        if (regPassword !== regConfirmPassword) {
            toast.error("两次密码输入不一致，请重新输入");
            return;
        }
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
            setResetCountdown(60);
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
        setResetConfirmPassword("");
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (resetNewPassword !== resetConfirmPassword) {
            toast.error("两次密码输入不一致，请重新输入");
            return;
        }
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
            setResetConfirmPassword("");
            setForgotSubmitted(false);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    // ===== PC 端输入框通用样式 =====
    const pcInputClass = "w-full bg-transparent border-0 border-b border-brand-charcoal/20 rounded-none py-4 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider placeholder:uppercase focus:outline-none focus:border-brand-gold/60 transition-colors";
    const pcBtnClass = "w-full py-4 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.02] active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2";

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                <motion.div
                    key="backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={closeAuthModal}
                    className="fixed inset-0 z-[99998] bg-slate-900/40 backdrop-blur-md md:bg-black/20"
                />
                <motion.div
                    key="pc-panel"
                    initial={{ x: "100%" }}
                    animate={{ x: 0, transition: { duration: 0.8, ease: [0.8, 0, 0.13, 1] } }}
                    exit={{ x: "100%", transition: { duration: 0.8, ease: [0.9, 0, 0.17, 1] } }}
                    className="hidden md:flex fixed inset-y-0 right-0 w-full bg-white flex-col z-[99999]"
                >
                        {/* 关闭按钮 */}
                        <button
                            onClick={closeAuthModal}
                            disabled={loading}
                            className="absolute top-8 right-8 z-20 flex h-10 w-10 items-center justify-center text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                        >
                            <X size={20} strokeWidth={1.5} />
                        </button>

                        {/* 返回按钮（非登录页） */}
                        {view !== 'login' && (
                            <button
                                onClick={() => setAuthView('login')}
                                disabled={loading}
                                className="absolute top-8 left-8 z-20 flex h-10 w-10 items-center justify-center text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                            >
                                <ArrowLeft size={20} strokeWidth={1.5} />
                            </button>
                        )}

                        {/* 内容区域 */}
                        <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto">
                            <div className="w-full max-w-[480px] py-12">
                                {/* Logo */}
                                <div className="mb-14 flex justify-center">
                                    <img
                                        src="/NIHPLOD-logo.svg"
                                        alt="NIHPLOD"
                                        className="h-[52px] object-contain"
                                    />
                                </div>

                                {/* ====== LOGIN ====== */}
                                {view === "login" && (
                                    <>
                                        <h1 className="text-center text-[2rem] font-light tracking-[0.15em] text-brand-charcoal mb-14">
                                            登录
                                        </h1>
                                        <form onSubmit={handleLogin} className="space-y-10">
                                            <div>
                                                <input
                                                    type="tel"
                                                    required
                                                    value={loginPhone}
                                                    onChange={(e) => setLoginPhone(e.target.value)}
                                                    className={pcInputClass}
                                                    placeholder="手机号"
                                                />
                                            </div>

                                            <div>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        required
                                                        value={loginPassword}
                                                        onChange={(e) => setLoginPassword(e.target.value)}
                                                        className={`${pcInputClass} pr-10`}
                                                        placeholder="密码"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                                                    >
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                <div className="mt-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={handleForgotPassword}
                                                        className="text-xs tracking-wider text-brand-charcoal/50 hover:text-brand-charcoal transition-colors"
                                                    >
                                                        忘记密码？
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className={pcBtnClass}
                                                >
                                                    {loading ? (
                                                        <div className="h-4 w-4 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
                                                    ) : "登录"}
                                                </button>
                                            </div>
                                        </form>

                                        <div className="mt-14 text-center space-y-5">
                                            <p className="text-xs tracking-[0.15em] text-brand-charcoal/40 uppercase">
                                                还没有账号？
                                            </p>
                                            <button
                                                onClick={() => setAuthView("register")}
                                                className={pcBtnClass}
                                            >
                                                立即注册
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* ====== REGISTER ====== */}
                                {view === "register" && (
                                    <>
                                        <h1 className="text-center text-[2rem] font-light tracking-[0.15em] text-brand-charcoal mb-12">
                                            注册会员
                                        </h1>
                                        <form onSubmit={handleRegister} className="space-y-8">
                                            <input
                                                type="text"
                                                required
                                                value={regName}
                                                onChange={(e) => setRegName(e.target.value)}
                                                className={pcInputClass}
                                                placeholder="姓名"
                                            />
                                            <input
                                                type="tel"
                                                required
                                                value={regPhone}
                                                onChange={(e) => setRegPhone(e.target.value)}
                                                className={pcInputClass}
                                                placeholder="手机号"
                                            />
                                            <div className="relative flex gap-3">
                                                <input
                                                    type="text"
                                                    required
                                                    maxLength={6}
                                                    value={regCode}
                                                    onChange={(e) => setRegCode(e.target.value)}
                                                    className={`${pcInputClass} flex-1`}
                                                    placeholder="验证码"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleSendRegCode}
                                                    disabled={regCodeSending || regCountdown > 0 || !regPhone}
                                                    className="shrink-0 self-end mb-2 px-4 py-2 text-xs font-medium tracking-wider text-brand-charcoal/60 border border-brand-charcoal/25 disabled:opacity-30 transition-all hover:bg-brand-charcoal/[0.02]"
                                                >
                                                    {regCountdown > 0 ? `${regCountdown}s` : "获取"}
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    required
                                                    minLength={6}
                                                    value={regPassword}
                                                    onChange={(e) => setRegPassword(e.target.value)}
                                                    className={`${pcInputClass} pr-10`}
                                                    placeholder="密码"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    required
                                                    minLength={6}
                                                    value={regConfirmPassword}
                                                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                                                    className={`${pcInputClass} pr-10`}
                                                    placeholder="确认密码"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>

                                            <div className="pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className={pcBtnClass}
                                                >
                                                    {loading ? (
                                                        <div className="h-4 w-4 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
                                                    ) : "注册"}
                                                </button>
                                            </div>
                                        </form>

                                        <div className="mt-10 text-center">
                                            <button
                                                onClick={() => setAuthView("login")}
                                                className="text-xs tracking-wider text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                                            >
                                                已有账号？返回登录
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* ====== FORGOT PASSWORD ====== */}
                                {view === "forgot_password" && (
                                    <>
                                        <h1 className="text-center text-[2rem] font-light tracking-[0.15em] text-brand-charcoal mb-12">
                                            {forgotSubmitted ? "重置密码" : "找回密码"}
                                        </h1>
                                        {forgotSubmitted ? (
                                            <form onSubmit={handleResetPassword} className="space-y-8">
                                                <p className="text-center text-sm text-brand-charcoal/60 tracking-wide">
                                                    验证码已发送至 {forgotPhone.slice(0, 3)}****{forgotPhone.slice(-4)}
                                                </p>
                                                <input
                                                    type="text"
                                                    required
                                                    maxLength={6}
                                                    value={resetCode}
                                                    onChange={(e) => setResetCode(e.target.value)}
                                                    className={pcInputClass}
                                                    placeholder="6位验证码"
                                                />
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        required
                                                        minLength={6}
                                                        value={resetNewPassword}
                                                        onChange={(e) => setResetNewPassword(e.target.value)}
                                                        className={`${pcInputClass} pr-10`}
                                                        placeholder="新密码"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                                                    >
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        required
                                                        minLength={6}
                                                        value={resetConfirmPassword}
                                                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                                                        className={`${pcInputClass} pr-10`}
                                                        placeholder="确认新密码"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                                                    >
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className={pcBtnClass}
                                                >
                                                    {loading ? (
                                                        <div className="h-4 w-4 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
                                                    ) : "确认重置"}
                                                </button>
                                                <div className="text-center">
                                                    <button
                                                        type="button"
                                                        onClick={handleSendResetLink}
                                                        disabled={loading || resetCountdown > 0}
                                                        className="text-xs tracking-wider text-brand-charcoal/50 hover:text-brand-charcoal transition-colors disabled:opacity-40"
                                                    >
                                                        {resetCountdown > 0 ? `${resetCountdown}s 后重新发送` : "重新发送验证码"}
                                                    </button>
                                                </div>
                                            </form>
                                        ) : (
                                            <form onSubmit={handleSendResetLink} className="space-y-10">
                                                <p className="text-center text-sm text-brand-charcoal/60 tracking-wide">
                                                    请输入您的注册手机号，我们将向您发送重置密码的验证码。
                                                </p>
                                                <div className="relative">
                                                    <Phone className="absolute left-0 top-1/2 -translate-y-1/2 text-brand-charcoal/40 w-5 h-5" />
                                                    <input
                                                        type="tel"
                                                        required
                                                        value={forgotPhone}
                                                        onChange={(e) => setForgotPhone(e.target.value)}
                                                        className={`${pcInputClass} pl-8`}
                                                        placeholder="手机号"
                                                    />
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className={pcBtnClass}
                                                >
                                                    {loading ? (
                                                        <div className="h-4 w-4 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
                                                    ) : "发送验证码"}
                                                </button>
                                            </form>
                                        )}

                                        <div className="mt-10 text-center">
                                            <button
                                                onClick={() => setAuthView("login")}
                                                className="text-xs tracking-wider text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                                            >
                                                返回登录
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* ====== WECHAT BIND ====== */}
                                {view === "wechat_bind" && (
                                    <>
                                        <h1 className="text-center text-[2rem] font-light tracking-[0.15em] text-brand-charcoal mb-10">
                                            绑定手机号
                                        </h1>
                                        <p className="text-center text-sm text-brand-charcoal/50 tracking-wide mb-10">
                                            微信授权成功，请绑定手机号以完成登录。
                                        </p>
                                        <form onSubmit={handleWechatBind} className="space-y-8">
                                            <input
                                                type="tel"
                                                required
                                                value={regPhone}
                                                onChange={(e) => setRegPhone(e.target.value)}
                                                className={pcInputClass}
                                                placeholder="手机号"
                                            />
                                            <div className="relative flex gap-3">
                                                <input
                                                    type="text"
                                                    required
                                                    maxLength={6}
                                                    value={regCode}
                                                    onChange={(e) => setRegCode(e.target.value)}
                                                    className={`${pcInputClass} flex-1`}
                                                    placeholder="验证码"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleSendRegCode}
                                                    disabled={regCodeSending || regCountdown > 0 || !regPhone}
                                                    className="shrink-0 self-end mb-2 px-4 py-2 text-xs font-medium tracking-wider text-brand-charcoal/60 border border-brand-charcoal/25 disabled:opacity-30 transition-all hover:bg-brand-charcoal/[0.02]"
                                                >
                                                    {regCountdown > 0 ? `${regCountdown}s` : "获取"}
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    required
                                                    minLength={6}
                                                    value={regPassword}
                                                    onChange={(e) => setRegPassword(e.target.value)}
                                                    className={`${pcInputClass} pr-10`}
                                                    placeholder="密码"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className={pcBtnClass}
                                            >
                                                {loading ? (
                                                    <div className="h-4 w-4 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
                                                ) : (
                                                    <>绑定手机号 <CheckCircle size={16} /></>
                                                )}
                                            </button>
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
            {isOpen && (
                    <motion.div
                        key="mobile-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="md:hidden fixed inset-0 z-[99999] flex items-center justify-center p-4"
                    >
                        <div
                            className="relative w-full max-w-[420px] bg-white rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[92vh]"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                        {/* Close Button */}
                        <button
                            onClick={closeAuthModal}
                            disabled={loading}
                            className="absolute top-6 right-6 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>

                        {/* Back Button (Only for register/forgot) */}
                        {view !== 'login' && (
                            <button
                                onClick={() => setAuthView('login')}
                                disabled={loading}
                                className="absolute top-6 left-6 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                <ArrowLeft size={16} strokeWidth={2.5} />
                            </button>
                        )}

                        <div className="overflow-y-auto">
                            {/* Header */}
                            <div className="p-10 pt-14 text-center pb-8">
                                {view !== 'wechat_bind' ? (
                                    <div className="mb-7 flex justify-center">
                                        <img
                                            src="/NIHPLOD-logo.svg"
                                            alt="NIHPLOD"
                                            className="h-[34px] object-contain"
                                        />
                                    </div>
                                ) : (
                                    <h1 className="text-xl font-bold text-slate-900 mb-3 tracking-[0.14em]">
                                        绑定手机号
                                    </h1>
                                )}
                                <p className={`text-slate-400 font-bold tracking-widest uppercase ${view === "register" ? "text-base" : "text-sm"}`}>
                                    {view === "login" ? "" : view === "register" ? "注册会员" : view === "forgot_password" ? "重置密码" : "微信授权成功，请绑定手机"}
                                </p>
                            </div>

                            {/* Forms */}
                            {view === "login" && (
                                <form onSubmit={handleLogin} className="px-10 pb-10 pt-2 flex flex-col gap-6">
                                    {/* Phone */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">手机号</label>
                                        <input
                                            type="tel"
                                            required
                                            value={loginPhone}
                                            onChange={(e) => setLoginPhone(e.target.value)}
                                            className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                            placeholder="请输入手机号"
                                        />
                                    </div>

                                    {/* Password */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">密码</span>
                                            <button
                                                type="button"
                                                onClick={handleForgotPassword}
                                                className="text-xs text-slate-400 hover:text-slate-700 transition-colors font-medium"
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
                                                className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                                placeholder="请输入密码"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/40 rounded-xl py-3.5 font-bold tracking-widest text-[13px] hover:bg-[#8B7355]/20 hover:border-[#8B7355]/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>登录 <ArrowRight size={16} /></>
                                        )}
                                    </button>
                                </form>
                            )}

                            {view === "register" && (
                                <form onSubmit={handleRegister} className="px-10 pb-10 pt-2 flex flex-col gap-6">
                                    {/* Name */}
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            required
                                            value={regName}
                                            onChange={(e) => setRegName(e.target.value)}
                                            className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                            placeholder="请输入姓名"
                                        />
                                    </div>

                                    {/* Phone */}
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="tel"
                                            required
                                            value={regPhone}
                                            onChange={(e) => setRegPhone(e.target.value)}
                                            className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                            placeholder="请输入手机号"
                                        />
                                    </div>

                                    {/* Verify Code */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                required
                                                maxLength={6}
                                                value={regCode}
                                                onChange={(e) => setRegCode(e.target.value)}
                                                className="flex-1 block bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                                placeholder="6位验证码"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSendRegCode}
                                                disabled={regCodeSending || regCountdown > 0 || !regPhone}
                                                className="px-4 py-3.5 rounded-xl bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/40 text-[13px] font-bold tracking-wider hover:bg-[#8B7355]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                                            >
                                                {regCountdown > 0 ? `${regCountdown}s` : "获取"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="flex flex-col gap-2">
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                minLength={6}
                                                value={regPassword}
                                                onChange={(e) => setRegPassword(e.target.value)}
                                                className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                                placeholder="请输入密码，至少6位字符"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Confirm Password */}
                                    <div className="flex flex-col gap-2">
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                minLength={6}
                                                value={regConfirmPassword}
                                                onChange={(e) => setRegConfirmPassword(e.target.value)}
                                                className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                                placeholder="请再次输入密码"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/40 rounded-xl py-3.5 font-bold tracking-widest text-[13px] hover:bg-[#8B7355]/20 hover:border-[#8B7355]/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>创建账户 <ArrowRight size={16} /></>
                                        )}
                                    </button>
                                </form>
                            )}

                            {view === "wechat_bind" && (
                                <form onSubmit={handleWechatBind} className="px-10 pb-10 pt-2 flex flex-col gap-6">
                                    <p className="text-center text-slate-400 text-sm">
                                        为了保障您的账户安全与多端同步体验，请绑定并在日后使用此手机号登录。
                                    </p>

                                    {/* Phone */}
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="tel"
                                            required
                                            value={regPhone}
                                            onChange={(e) => setRegPhone(e.target.value)}
                                            className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                            placeholder="请输入绑定的真实手机号"
                                        />
                                    </div>

                                    {/* Verify Code */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                required
                                                maxLength={6}
                                                value={regCode}
                                                onChange={(e) => setRegCode(e.target.value)}
                                                className="flex-1 block bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                                placeholder="6位验证码"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSendRegCode}
                                                disabled={regCodeSending || regCountdown > 0 || !regPhone}
                                                className="px-4 py-3.5 rounded-xl bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/40 text-[13px] font-bold tracking-wider hover:bg-[#8B7355]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                                            >
                                                {regCountdown > 0 ? `${regCountdown}s` : "获取"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="flex flex-col gap-2">
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                minLength={6}
                                                value={regPassword}
                                                onChange={(e) => setRegPassword(e.target.value)}
                                                className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                                placeholder="至少6位密码，用于后续直接登录"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/40 rounded-xl py-3.5 font-bold tracking-widest text-[13px] hover:bg-[#8B7355]/20 hover:border-[#8B7355]/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>绑定手机号并完成 <CheckCircle size={16} /></>
                                        )}
                                    </button>
                                </form>
                            )}

                            {view === "forgot_password" && (
                                <div className="px-10 pb-10 pt-2 flex flex-col gap-6">
                                    {forgotSubmitted ? (
                                        <form onSubmit={handleResetPassword} className="flex flex-col gap-6">
                                            <div className="text-center py-2">
                                                <h3 className="text-lg font-bold text-slate-900 mb-1">验证码已发送至 {forgotPhone}</h3>
                                                <button
                                                    type="button"
                                                    onClick={handleSendResetLink}
                                                    disabled={loading || resetCountdown > 0}
                                                    className="text-[#8B7355] text-xs font-bold tracking-wider hover:underline disabled:opacity-50"
                                                >
                                                    {resetCountdown > 0 ? `${resetCountdown}s 后重新发送` : "重新发送验证码"}
                                                </button>
                                            </div>

                                            {/* Code Input */}
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    type="text"
                                                    required
                                                    maxLength={6}
                                                    value={resetCode}
                                                    onChange={(e) => setResetCode(e.target.value)}
                                                    className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                                    placeholder="6位验证码"
                                                />
                                            </div>

                                            {/* New Password Input */}
                                            <div className="flex flex-col gap-2">
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        required
                                                        minLength={6}
                                                        value={resetNewPassword}
                                                        onChange={(e) => setResetNewPassword(e.target.value)}
                                                        className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                                        placeholder="至少6位新密码"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                    >
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Confirm Password Input */}
                                            <div className="flex flex-col gap-2">
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        required
                                                        minLength={6}
                                                        value={resetConfirmPassword}
                                                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                                                        className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                                        placeholder="请再次输入新密码"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                    >
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/40 rounded-xl py-3.5 font-bold tracking-widest text-[13px] hover:bg-[#8B7355]/20 hover:border-[#8B7355]/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                                            >
                                                {loading ? (
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    "完成重置"
                                                )}
                                            </button>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleSendResetLink} className="flex flex-col gap-6">
                                            <p className="text-slate-400 text-sm">
                                                请输入您的注册手机号，我们将向您发送重置密码的验证码。
                                            </p>

                                            <div className="flex flex-col gap-2">
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                                    <input
                                                        type="tel"
                                                        required
                                                        value={forgotPhone}
                                                        onChange={(e) => setForgotPhone(e.target.value)}
                                                        className="block w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-11 pr-5 text-[13px] text-slate-900 outline-none transition-all duration-300 focus:bg-white focus:border-[#C6A87C]/40 focus:ring-4 focus:ring-[#C6A87C]/15 placeholder:text-slate-300"
                                                        placeholder="请输入手机号"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/40 rounded-xl py-3.5 font-bold tracking-widest text-[13px] hover:bg-[#8B7355]/20 hover:border-[#8B7355]/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                                            >
                                                {loading ? (
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    "发送验证码"
                                                )}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* View Switcher Footer */}
                        {view !== 'forgot_password' && view !== 'wechat_bind' && (
                            <div className="px-10 pb-10 pt-2 text-center">
                                {view === "login" ? (
                                    <p className="text-slate-400 text-sm font-medium">
                                        还没有账号？{" "}
                                        <button
                                            onClick={() => setAuthView("register")}
                                            className="text-[#8B7355] font-bold hover:underline transition-colors"
                                        >
                                            立即注册
                                        </button>
                                    </p>
                                ) : (
                                    <p className="text-slate-400 text-sm font-medium">
                                        已有账号？{" "}
                                        <button
                                            onClick={() => setAuthView("login")}
                                            className="text-[#8B7355] font-bold hover:underline transition-colors"
                                        >
                                            立即登录
                                        </button>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Footer for Forgot Password */}
                        {view === 'forgot_password' && (
                            <div className="px-10 pb-10 pt-2 text-center">
                                <button
                                    onClick={() => setAuthView("login")}
                                    className="text-slate-500 font-bold hover:underline transition-colors text-sm"
                                >
                                    返回登录
                                </button>
                            </div>
                        )}

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
