"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, ArrowLeft, Phone, CheckCircle, Check, CheckCircle2, ChevronLeft, ArrowLeftRight } from "lucide-react";
import { validatePasswordStrength, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

export function AuthModal() {
    const { isOpen, view, openAuthModal, closeAuthModal, setAuthView } = useAuthModal();
    const { login, loginWithCode, register } = useAuth();
    const toast = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        if (searchParams.get("login") === "wechat_bind") {
            // exchange token 已通过 httpOnly Cookie 传递，无需从 URL 读取
            // 保留最终重定向目标，供绑定成功后使用
            const redirect = searchParams.get("redirect");
            if (redirect) {
                sessionStorage.setItem("auth_redirect", redirect);
            }
            openAuthModal("wechat_bind");
            // Remove params from URL so it doesn't trigger again
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("login");
            cleanUrl.searchParams.delete("wechat_exchange_token");
            cleanUrl.searchParams.delete("redirect");
            router.replace(cleanUrl.pathname + cleanUrl.search, { scroll: false });
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
    const [mobileAgreed, setMobileAgreed] = useState(false);
    const [agreementShake, setAgreementShake] = useState(0);
    const [mobileForgotStep, setMobileForgotStep] = useState<"phone" | "code" | "password" | "success">("phone");

    // Mobile login method toggle
    const [loginMethod, setLoginMethod] = useState<"password" | "code">("password");
    const [loginCode, setLoginCode] = useState("");
    const [loginCodeCountdown, setLoginCodeCountdown] = useState(0);
    const [loginCodeSending, setLoginCodeSending] = useState(false);

    // Reset states when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            setLoginPhone("");
            setLoginPassword("");
            setLoginCode("");
            setRegName("");
            setRegPhone("");
            setRegCode("");
            setRegPassword("");
            setRegConfirmPassword("");
            setForgotPhone("");
            setForgotSubmitted(false);
            setResetCode("");
            setResetNewPassword("");
            setResetConfirmPassword("");
            setRegCodeSending(false);
            setRegCountdown(0);
            setResetCountdown(0);
            setLoginCodeCountdown(0);
            setLoginCodeSending(false);
            setShowPassword(false);
            setMobileAgreed(false);
            setMobileForgotStep("phone");
            setLoginMethod("password");
            setAgreementShake(0);
        }
    }, [isOpen]);

    // Reset shared fields when entering WeChat Bind to avoid state leakage from register form
    useEffect(() => {
        if (view === "wechat_bind") {
            setRegPhone("");
            setRegCode("");
            setRegPassword("");
            setMobileAgreed(false);
        }
    }, [view]);

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

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (loginCodeCountdown > 0) {
            timer = setTimeout(() => setLoginCodeCountdown(prev => prev - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [loginCodeCountdown]);

    // 禁止背景滚动（移动端使用 fixed 定位防止 iOS 弹性滚动）
    useBodyScrollLock({ enabled: isOpen, iosSafe: true });

    // 登录/注册成功后处理 redirect
    const handleAuthSuccess = () => {
        const redirectUrl = sessionStorage.getItem("auth_redirect");
        if (redirectUrl) {
            sessionStorage.removeItem("auth_redirect");
            closeAuthModal();
            router.push(redirectUrl);
        } else {
            closeAuthModal();
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mobileAgreed) {
            setAgreementShake(n => n + 1);
            return;
        }
        setLoading(true);
        try {
            if (loginMethod === "code") {
                await loginWithCode({ phone: loginPhone, code: loginCode });
            } else {
                await login({ phone: loginPhone, password: loginPassword });
            }
            toast.success("欢迎回来！");
            handleAuthSuccess();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("[Login]", err.message);
            toast.error(err.message || "登录未成功，请检查手机号和密码后重试。");
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
        const passwordCheck = validatePasswordStrength(regPassword);
        if (!passwordCheck.valid) {
            toast.error(passwordCheck.message || "密码不符合要求");
            return;
        }
        if (!mobileAgreed) {
            setAgreementShake(n => n + 1);
            return;
        }
        setLoading(true);
        try {
            await register({ name: regName, phone: regPhone, code: regCode, password: regPassword });
            toast.success("注册成功！");
            handleAuthSuccess();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("[Register]", err.message);
            toast.error(err.message || "注册未成功，请稍后再试。");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelWechatBind = () => {
        // 微信绑定凭证由 httpOnly Cookie (__Host-wechat_bind_token) 管理
        // 取消绑定时后端清除该 Cookie，前端无需额外操作
        toast.error("已退出微信登录，您可以使用手机号登录。");
        closeAuthModal();
    };

    const handleWechatBind = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mobileAgreed) {
            setAgreementShake(n => n + 1);
            return;
        }
        if (!regPassword || regPassword.length === 0) {
            toast.error("请设置登录密码");
            return;
        }
        const passwordCheck = validatePasswordStrength(regPassword);
        if (!passwordCheck.valid) {
            toast.error(passwordCheck.message || "密码不符合要求");
            return;
        }
        setLoading(true);
        try {
            const res = await fetchWithCsrf("/api/auth/wechat/bind", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: regPhone,
                    code: regCode,
                    password: regPassword,
                    allowAutoPassword: false,
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "绑定未成功");

            toast.success("绑定成功！");

            // 检查是否有 pending redirect
            const redirectUrl = sessionStorage.getItem("auth_redirect");
            sessionStorage.removeItem("auth_redirect");
            window.location.href = redirectUrl || "/";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("[WechatBind]", err.message);
            toast.error(err.message || "绑定未成功，请稍后重试");
        } finally {
            setLoading(false);
        }
    };

    const handleWechatLogin = async () => {
        if (!mobileAgreed) {
            setAgreementShake(n => n + 1);
            return;
        }
        setLoading(true);
        try {
            // 直接通过浏览器跳转到子站微信入口，子站会再 302 到官网设置 nonce Cookie。
            // 这样可确保 wechat_oauth_nonce 写在官网域名下，回调时能正确校验 state。
            const redirectTarget = sessionStorage.getItem("auth_redirect");
            const callbackUrl = `${window.location.origin}/api/auth/wechat/callback`;
            const returnUrl = redirectTarget
                ? `${callbackUrl}?redirect=${encodeURIComponent(redirectTarget)}`
                : callbackUrl;
            window.location.href = `/api/auth/wechat?redirect=${encodeURIComponent(returnUrl)}`;
        } catch {
            toast.error("网络连接异常，请检查网络后重试。");
            setLoading(false);
        }
    };

    const handleSendRegCode = async () => {
        if (!/^1[3-9]\d{9}$/.test(regPhone)) {
            toast.error("请输入有效的 11 位手机号。");
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
            if (!res.ok) throw new Error(data.error?.message || data.error || "验证码发送未成功");
            toast.success("验证码已发送");
            setRegCountdown(60);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("[SendRegCode]", error.message);
            toast.error(error.message || "验证码发送未成功，请稍后再试。");
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

            if (!res.ok) throw new Error(data.error?.message || data.error || "请求未成功");

            setForgotSubmitted(true);
            setResetCountdown(60);
            toast.success("重置验证码已发送");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("[ForgotPassword]", error.message);
            toast.error(error.message || "验证码发送未成功，请稍后再试。");
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
        setMobileForgotStep("phone");
    };

    // 手机端登录面板：发送登录验证码
    const handleSendLoginCode = async () => {
        if (!/^1[3-9]\d{9}$/.test(loginPhone)) {
            toast.error("请输入有效的 11 位手机号。");
            return;
        }
        setLoginCodeSending(true);
        try {
            const res = await fetch("/api/auth/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: loginPhone, type: "login" })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || data.error || "发送未成功");
            setLoginCodeCountdown(60);
            toast.success("验证码已发送");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("[SendLoginCode]", error.message);
            toast.error(error.message || "验证码发送未成功，请稍后再试。");
        } finally {
            setLoginCodeSending(false);
        }
    };

    // 手机端专用：发送重置验证码
    const handleMobileSendResetCode = async () => {
        if (!/^1[3-9]\d{9}$/.test(forgotPhone)) {
            toast.error("请输入有效的 11 位手机号。");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/auth/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: forgotPhone, type: "reset" })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || data.error || "请求未成功");
            setResetCountdown(60);
            setMobileForgotStep("code");
            toast.success("重置验证码已发送");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("[MobileResetCode]", error.message);
            toast.error(error.message || "验证码发送未成功，请稍后再试。");
        } finally {
            setLoading(false);
        }
    };

    // 手机端专用：重置密码
    const handleMobileResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (resetNewPassword !== resetConfirmPassword) {
            toast.error("两次密码输入不一致，请重新输入");
            return;
        }
        const passwordCheck = validatePasswordStrength(resetNewPassword);
        if (!passwordCheck.valid) {
            toast.error(passwordCheck.message || "密码不符合要求");
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
            if (!res.ok) throw new Error(data.error?.message || data.error || "重置未成功");
            toast.success("密码已重置，请登录");
            setResetCode("");
            setResetNewPassword("");
            setResetConfirmPassword("");
            setMobileForgotStep("success");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("[MobileResetPassword]", error.message);
            toast.error(error.message || "密码重置未成功，请稍后再试。");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (resetNewPassword !== resetConfirmPassword) {
            toast.error("两次密码输入不一致，请重新输入");
            return;
        }
        const passwordCheck = validatePasswordStrength(resetNewPassword);
        if (!passwordCheck.valid) {
            toast.error(passwordCheck.message || "密码不符合要求");
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
            if (!res.ok) throw new Error(data.error?.message || data.error || "重置未成功");

            toast.success("密码已重置，请登录");
            setAuthView("login");
            setLoginPhone(forgotPhone);
            // reset form data
            setResetCode("");
            setResetNewPassword("");
            setResetConfirmPassword("");
            setForgotSubmitted(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("[ResetPassword]", error.message);
            toast.error(error.message || "密码重置未成功，请稍后再试。");
        } finally {
            setLoading(false);
        }
    };

    // ===== PC 端输入框通用样式 =====
    const pcInputClass = "w-full bg-transparent border-0 border-b border-brand-charcoal/20 rounded-none py-4 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider placeholder:uppercase focus:outline-none focus:border-brand-charcoal/40 transition-colors";
    const pcBtnClass = "w-full py-4 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2";

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
                    onClick={view === "wechat_bind" ? undefined : closeAuthModal}
                    className="fixed inset-0 z-[99998] bg-black/20 backdrop-blur-md"
                />
                <motion.div
                    key={`pc-panel-${view}`}
                    initial={{ x: "100%" }}
                    animate={{ x: 0, transition: { duration: 0.8, ease: [0.8, 0, 0.13, 1] } }}
                    exit={{ x: "100%", transition: { duration: 0.5, ease: [0.8, 0, 0.13, 1] } }}
                    className="hidden md:flex fixed inset-y-0 right-0 w-full bg-white flex-col z-[99999]"
                >
                        {/* 关闭/取消按钮 */}
                        {view === "wechat_bind" ? (
                            <button
                                onClick={handleCancelWechatBind}
                                disabled={loading}
                                className="absolute top-8 right-8 z-20 flex items-center gap-1.5 px-4 py-2 text-sm tracking-wider text-brand-charcoal/50 hover:text-brand-charcoal/70 transition-colors"
                            >
                                取消绑定
                            </button>
                        ) : (
                            <button
                                onClick={closeAuthModal}
                                disabled={loading}
                                className="absolute top-8 right-8 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/40 backdrop-blur-sm transition-all hover:bg-brand-charcoal/10 hover:text-brand-charcoal/70"
                            >
                                <X size={20} strokeWidth={1.5} />
                            </button>
                        )}

                        {/* 返回按钮（非登录页） */}
                        {view !== 'login' && view !== 'wechat_bind' && (
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
                                        <form id="pc-login-form" onSubmit={handleLogin} className="space-y-10">
                                            <div>
                                                <input
                                                    type="tel"
                                                    inputMode="numeric"
                                                    required
                                                    value={loginPhone}
                                                    onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                                                    className={pcInputClass}
                                                    placeholder="手机号"
                                                />
                                            </div>

                                            {loginMethod === "code" && (
                                                <div className="relative flex gap-3">
                                                    <input
                                                        type="text"
                                                        required
                                                        maxLength={6}
                                                        value={loginCode}
                                                        onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                        className={`${pcInputClass} flex-1`}
                                                        placeholder="验证码"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleSendLoginCode}
                                                        disabled={loginCodeSending || loginCodeCountdown > 0 || !loginPhone}
                                                        className="shrink-0 self-end mb-2 px-4 py-2 text-xs font-medium tracking-wider text-brand-charcoal/60 border border-brand-charcoal/25 disabled:opacity-30 transition-all hover:bg-brand-charcoal/[0.02]"
                                                    >
                                                        {loginCodeCountdown > 0 ? `${loginCodeCountdown}s` : "获取验证码"}
                                                    </button>
                                                </div>
                                            )}

                                            {loginMethod === "password" && (
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
                                            )}

                                            <div className="flex items-center justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLoginMethod(loginMethod === "password" ? "code" : "password");
                                                        setLoginCode("");
                                                        setLoginPassword("");
                                                    }}
                                                    className="text-xs tracking-wider text-brand-charcoal/50 hover:text-brand-charcoal transition-colors inline-flex items-center gap-1.5"
                                                >
                                                    <ArrowLeftRight className="h-3 w-3" strokeWidth={2} />
                                                    {loginMethod === "password" ? "验证码登录" : "密码登录"}
                                                </button>
                                                {loginMethod === "password" && (
                                                    <button
                                                        type="button"
                                                        onClick={handleForgotPassword}
                                                        className="text-xs tracking-wider text-brand-charcoal/50 hover:text-brand-charcoal transition-colors"
                                                    >
                                                        忘记密码？
                                                    </button>
                                                )}
                                            </div>

                                            <motion.div
                                                key={agreementShake}
                                                initial={{ x: 0 }}
                                                animate={{ x: [-5, 5, -5, 5, -3, 3, 0] }}
                                                transition={{ duration: 0.4 }}
                                            >
                                                <label className="flex cursor-pointer items-center gap-2.5 group/agreement">
                                                    <div className="relative flex-shrink-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={mobileAgreed}
                                                            onChange={(e) => setMobileAgreed(e.target.checked)}
                                                            className="peer sr-only"
                                                        />
                                                        <div className="h-4 w-4 rounded border border-brand-charcoal/25 bg-transparent transition-all peer-checked:bg-brand-charcoal/50 peer-checked:border-brand-charcoal/50" />
                                                        <Check className="absolute inset-0 m-auto h-3 w-3 scale-0 text-white transition-transform peer-checked:scale-100" strokeWidth={3} />
                                                    </div>
                                                    <span className="text-xs text-brand-charcoal/50 tracking-wide">
                                                        我已阅读并同意
                                                        <a href="https://nihplod.cn/terms" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《用户协议》</a>
                                                        和
                                                        <a href="https://nihplod.cn/privacy" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《隐私政策》</a>
                                                    </span>
                                                </label>
                                            </motion.div>

                                        </form>

                                        <div className="mt-6 flex flex-col gap-6 text-center">
                                            <button
                                                type="submit"
                                                form="pc-login-form"
                                                disabled={loading || !mobileAgreed}
                                                className={pcBtnClass}
                                            >
                                                {loading ? (
                                                    <div className="h-5 w-5 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
                                                ) : "登录"}
                                            </button>

                                            <div className="relative">
                                                <div className="absolute inset-0 flex items-center">
                                                    <div className="w-full border-t border-brand-charcoal/10"></div>
                                                </div>
                                                <div className="relative flex justify-center text-xs">
                                                    <span className="px-4 bg-white text-brand-charcoal/40 tracking-wider uppercase">其他登录方式</span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleWechatLogin}
                                                disabled={loading || !mobileAgreed}
                                                className={`w-full py-4 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2`}
                                            >
                                                <svg className="w-5 h-5 text-[#07C160]" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088-.182-.013-.373-.027-.545-.035h-.06zm-2.89 3.217c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" />
                                                </svg>
                                                微信登录
                                            </button>
                                        </div>

                                        <div className="mt-6 text-center">
                                            <button
                                                type="button"
                                                onClick={() => setAuthView("register")}
                                                className="inline-flex h-7 min-h-0 items-center justify-center text-xs text-brand-charcoal/40 tracking-wide hover:text-brand-charcoal/70 transition-colors"
                                            >
                                                还没有账号？立即注册
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
                                                    minLength={PASSWORD_MIN_LENGTH}
                                                    value={regPassword}
                                                    onChange={(e) => setRegPassword(e.target.value)}
                                                    className={`${pcInputClass} pr-10`}
                                                    placeholder="密码（8位且含大写/小写/数字）"
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
                                                    minLength={PASSWORD_MIN_LENGTH}
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

                                            <motion.div
                                                key={agreementShake}
                                                initial={{ x: 0 }}
                                                animate={{ x: [-5, 5, -5, 5, -3, 3, 0] }}
                                                transition={{ duration: 0.4 }}
                                            >
                                                <label className="flex cursor-pointer items-center gap-2.5 group/agreement">
                                                    <div className="relative flex-shrink-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={mobileAgreed}
                                                            onChange={(e) => setMobileAgreed(e.target.checked)}
                                                            className="peer sr-only"
                                                        />
                                                        <div className="h-4 w-4 rounded border border-brand-charcoal/25 bg-transparent transition-all peer-checked:bg-brand-charcoal/50 peer-checked:border-brand-charcoal/50" />
                                                        <Check className="absolute inset-0 m-auto h-3 w-3 scale-0 text-white transition-transform peer-checked:scale-100" strokeWidth={3} />
                                                    </div>
                                                    <span className="text-xs text-brand-charcoal/50 tracking-wide">
                                                        我已阅读并同意
                                                        <a href="https://nihplod.cn/terms" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《用户协议》</a>
                                                        和
                                                        <a href="https://nihplod.cn/privacy" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《隐私政策》</a>
                                                    </span>
                                                </label>
                                            </motion.div>

                                            <div className="pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={loading || !mobileAgreed}
                                                    className={pcBtnClass}
                                                >
                                                    {loading ? (
                                                        <div className="h-5 w-5 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
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
                                    <motion.div
                                        initial={{ x: 40, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ duration: 0.5, ease: [0.8, 0, 0.13, 1] }}
                                    >
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
                                                        minLength={PASSWORD_MIN_LENGTH}
                                                        value={resetNewPassword}
                                                        onChange={(e) => setResetNewPassword(e.target.value)}
                                                        className={`${pcInputClass} pr-10`}
                                                        placeholder="新密码（8位且含大写/小写/数字）"
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
                                                        minLength={PASSWORD_MIN_LENGTH}
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
                                                        <div className="h-5 w-5 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
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
                                                inputMode="numeric"
                                                required
                                                value={forgotPhone}
                                                onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                                                className={pcInputClass}
                                                placeholder="手机号"
                                            />
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className={pcBtnClass}
                                                >
                                                    {loading ? (
                                                        <div className="h-5 w-5 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
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
                                    </motion.div>
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
                                                    minLength={PASSWORD_MIN_LENGTH}
                                                    value={regPassword}
                                                    onChange={(e) => setRegPassword(e.target.value)}
                                                    className={`${pcInputClass} pr-10`}
                                                    placeholder="密码（8位且含大写/小写/数字）"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                            <motion.div
                                                key={agreementShake}
                                                initial={{ x: 0 }}
                                                animate={{ x: [-5, 5, -5, 5, -3, 3, 0] }}
                                                transition={{ duration: 0.4 }}
                                            >
                                                <label className="flex cursor-pointer items-center gap-2.5 group/agreement">
                                                    <div className="relative flex-shrink-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={mobileAgreed}
                                                            onChange={(e) => setMobileAgreed(e.target.checked)}
                                                            className="peer sr-only"
                                                        />
                                                        <div className="h-4 w-4 rounded border border-brand-charcoal/25 bg-transparent transition-all peer-checked:bg-brand-charcoal/50 peer-checked:border-brand-charcoal/50" />
                                                        <Check className="absolute inset-0 m-auto h-3 w-3 scale-0 text-white transition-transform peer-checked:scale-100" strokeWidth={3} />
                                                    </div>
                                                    <span className="text-xs text-brand-charcoal/50 tracking-wide">
                                                        我已阅读并同意
                                                        <a href="https://nihplod.cn/terms" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《用户协议》</a>
                                                        和
                                                        <a href="https://nihplod.cn/privacy" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《隐私政策》</a>
                                                    </span>
                                                </label>
                                            </motion.div>
                                            <button
                                                type="submit"
                                                disabled={loading || !mobileAgreed}
                                                className={pcBtnClass}
                                            >
                                                {loading ? (
                                                    <div className="h-5 w-5 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
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
                    key={`mobile-modal-${view}`}
                    initial={{ x: "100%" }}
                    animate={{ x: 0, transition: { duration: 0.8, ease: [0.8, 0, 0.13, 1] } }}
                    exit={{ x: "100%", transition: { duration: 0.5, ease: [0.8, 0, 0.13, 1] } }}
                    className="md:hidden fixed inset-0 z-[99999] pl-4 pr-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] bg-[#F8F7F3] flex flex-col"
                >
                    {/* 手机端顶部栏 */}
                    <div className="flex-shrink-0 h-[56px] w-full flex items-center justify-center relative">
                        <button
                            type="button"
                            onClick={
                                view === "wechat_bind" ? handleCancelWechatBind :
                                view === "forgot_password" ? () => { setAuthView("login"); setMobileForgotStep("phone"); } :
                                closeAuthModal
                            }
                            className="absolute left-0 top-0 bottom-0 flex items-center justify-center px-4 py-[10px]"
                        >
                            <ChevronLeft className="h-6 w-6 text-[#00263E]" />
                        </button>
                        {view !== "login" && (
                            <img
                                src="/NIHPLOD-logo.svg"
                                alt="NIHPLOD"
                                className="object-contain h-auto w-[110px]"
                            />
                        )}
                    </div>

                    <div className="flex-1 flex flex-col overflow-y-auto scrollbar-hide">
                        <div className="min-h-full flex flex-col px-6
                                        before:content-[''] before:flex-[1_0_0]
                                        after:content-[''] after:flex-[1_0_0]">

                        {/* ====== LOGIN ====== */}
                        {view === "login" && (
                            <div className="flex flex-col gap-14">
                                <div className="flex justify-center">
                                    <img
                                        src="/NIHPLOD-logo.svg"
                                        alt="NIHPLOD Logo"
                                        className="object-contain h-auto w-[140px]"
                                    />
                                </div>
                                <form onSubmit={handleLogin} className="w-full space-y-6">
                                    <div>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            autoComplete="tel"
                                            required
                                            value={loginPhone}
                                            onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                                            placeholder="手机号"
                                            className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                        />
                                    </div>

                                    {/* 验证码输入 - 仅验证码登录时显示 */}
                                    {loginMethod === "code" && (
                                        <div className="relative flex gap-2 animate-fade-scale-in">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={loginCode}
                                                onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                placeholder="验证码"
                                                className="flex-1 bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                            />
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    type="button"
                                                    onClick={handleSendLoginCode}
                                                    disabled={loginCodeCountdown > 0 || loginPhone.length !== 11 || loginCodeSending}
                                                    className="inline-flex h-12 min-h-0 items-center justify-center px-4 text-xs font-medium tracking-wider text-brand-charcoal/60 border border-brand-charcoal/25 disabled:opacity-30 transition-all"
                                                >
                                                    {loginCodeCountdown > 0 ? `${loginCodeCountdown}s` : "获取验证码"}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* 密码输入 - 仅密码登录时显示 */}
                                    {loginMethod === "password" && (
                                        <div className="animate-fade-scale-in relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                value={loginPassword}
                                                onChange={(e) => setLoginPassword(e.target.value)}
                                                placeholder="密码"
                                                maxLength={32}
                                                className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 pr-10 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-charcoal/40 hover:text-brand-charcoal/70 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLoginMethod(loginMethod === "password" ? "code" : "password");
                                                setLoginCode("");
                                                setLoginPassword("");
                                            }}
                                            className={`inline-flex h-7 min-h-0 items-center gap-1.5 text-xs tracking-wider transition-colors ${
                                                loginMethod === "code"
                                                    ? "text-brand-charcoal"
                                                    : "text-brand-charcoal/50 hover:text-brand-charcoal"
                                            }`}
                                        >
                                            <ArrowLeftRight className="h-3 w-3" strokeWidth={2} />
                                            {loginMethod === "password" ? "验证码登录" : "密码登录"}
                                        </button>
                                        {loginMethod === "password" && (
                                            <button
                                                type="button"
                                                onClick={handleForgotPassword}
                                                className="inline-flex h-7 min-h-0 items-center text-xs tracking-wider text-brand-charcoal/50 hover:text-brand-charcoal transition-colors"
                                            >
                                                找回密码
                                            </button>
                                        )}
                                    </div>

                                    <motion.div
                                        key={agreementShake}
                                        initial={{ x: 0 }}
                                        animate={{ x: [-5, 5, -5, 5, -3, 3, 0] }}
                                        transition={{ duration: 0.4 }}
                                    >
                                        <label className="flex cursor-pointer items-center gap-2.5 group/agreement">
                                            <div className="relative flex-shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={mobileAgreed}
                                                    onChange={(e) => setMobileAgreed(e.target.checked)}
                                                    className="peer sr-only"
                                                />
                                                <div className="h-4 w-4 rounded border border-brand-charcoal/25 bg-transparent transition-all peer-checked:bg-brand-charcoal/50 peer-checked:border-brand-charcoal/50" />
                                                <Check className="absolute inset-0 m-auto h-3 w-3 scale-0 text-white transition-transform peer-checked:scale-100" strokeWidth={3} />
                                            </div>
                                            <span className="text-xs text-brand-charcoal/50 tracking-wide">
                                                我已阅读并同意
                                                <a href="https://nihplod.cn/terms" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《用户协议》</a>
                                                和
                                                <a href="https://nihplod.cn/privacy" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《隐私政策》</a>
                                            </span>
                                        </label>
                                    </motion.div>
                                </form>

                                <div className="flex flex-col gap-6">
                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading || !mobileAgreed}
                                            className="w-full py-3.5 min-h-12 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40"
                                        >
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                {loading ? (
                                                    <div className="h-5 w-5 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
                                                ) : "立即登录"}
                                            </span>
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-brand-charcoal/10"></div>
                                        </div>
                                        <div className="relative flex justify-center text-xs">
                                            <span className="px-4 bg-[#F8F7F3] text-brand-charcoal/40 tracking-wide">其他登录方式</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleWechatLogin}
                                        disabled={loading || !mobileAgreed}
                                        className="w-full py-3.5 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-5 h-5 text-[#07C160]" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.11.24-.245 0-.06-.024-.12-.04-.178l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088-.182-.013-.373-.027-.545-.035h-.06zm-2.89 3.217c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" />
                                        </svg>
                                        微信登录
                                    </button>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setAuthView("register")}
                                        className="inline-flex h-7 min-h-0 items-center justify-center text-xs text-brand-charcoal/40 tracking-wide hover:text-brand-charcoal/70 transition-colors"
                                    >
                                        还没有账户？立即注册
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ====== REGISTER ====== */}
                        {view === "register" && (
                            <div className="flex flex-col gap-10">
                                <div className="text-center pt-[6px] pb-4">
                                    <h2 className="text-[24px] font-medium tracking-[0.2em] text-[#00263E]">注册会员</h2>
                                    <div className="mx-auto mt-2 w-[70px] border-b-[1.5px] border-[#00263E]" />
                                </div>
                                <form onSubmit={handleRegister} className="w-full space-y-6">
                                    <div>
                                        <input
                                            type="text"
                                            required
                                            value={regName}
                                            onChange={(e) => setRegName(e.target.value)}
                                            placeholder="姓名"
                                            className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            autoComplete="tel"
                                            required
                                            value={regPhone}
                                            onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                                            placeholder="手机号"
                                            className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                        />
                                    </div>
                                    <div className="relative flex gap-2">
                                        <input
                                            type="text"
                                            required
                                            maxLength={6}
                                            value={regCode}
                                            onChange={(e) => setRegCode(e.target.value)}
                                            placeholder="验证码"
                                            className="flex-1 bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSendRegCode}
                                            disabled={regCodeSending || regCountdown > 0 || !regPhone}
                                            className="shrink-0 self-end mb-2 px-3 h-12 inline-flex items-center justify-center text-xs font-medium tracking-wider text-brand-charcoal/60 border border-brand-charcoal/25 disabled:opacity-30 transition-all"
                                        >
                                            {regCountdown > 0 ? `${regCountdown}s` : "获取验证码"}
                                        </button>
                                    </div>
                                    <div>
                                        <input
                                            type="password"
                                            required
                                            minLength={PASSWORD_MIN_LENGTH}
                                            value={regPassword}
                                            onChange={(e) => setRegPassword(e.target.value)}
                                            placeholder="密码（8位且含大写/小写/数字）"
                                            maxLength={32}
                                            className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="password"
                                            required
                                            minLength={PASSWORD_MIN_LENGTH}
                                            value={regConfirmPassword}
                                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                                            placeholder="确认密码"
                                            maxLength={32}
                                            className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                        />
                                    </div>

                                    <motion.div
                                        key={agreementShake}
                                        initial={{ x: 0 }}
                                        animate={{ x: [-5, 5, -5, 5, -3, 3, 0] }}
                                        transition={{ duration: 0.4 }}
                                    >
                                    <label className="flex cursor-pointer items-center gap-2.5 pt-2 group/agreement">
                                        <div className="relative flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={mobileAgreed}
                                                onChange={(e) => setMobileAgreed(e.target.checked)}
                                                className="peer sr-only"
                                            />
                                            <div className="h-4 w-4 rounded border border-brand-charcoal/25 bg-transparent transition-all peer-checked:bg-brand-gold peer-checked:border-brand-gold" />
                                            <Check className="absolute inset-0 m-auto h-3 w-3 scale-0 text-white transition-transform peer-checked:scale-100" strokeWidth={3} />
                                        </div>
                                        <span className="text-xs text-brand-charcoal/50 tracking-wide">
                                            我已阅读并同意
                                            <a href="https://nihplod.cn/terms" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《用户协议》</a>
                                            和
                                            <a href="https://nihplod.cn/privacy" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《隐私政策》</a>
                                        </span>
                                    </label>
                                    </motion.div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading || !mobileAgreed}
                                            className="w-full py-3.5 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40"
                                        >
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                {loading ? (
                                                    <div className="h-5 w-5 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
                                                ) : "立即注册"}
                                            </span>
                                        </button>
                                    </div>
                                </form>

                                <div className="flex flex-col gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setAuthView("login")}
                                        className="inline-flex h-7 min-h-0 items-center justify-center text-xs text-brand-charcoal/40 tracking-wide hover:text-brand-charcoal/70 transition-colors"
                                    >
                                        已有账户？返回登录
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ====== FORGOT PASSWORD ====== */}
                        {view === "forgot_password" && (
                            <motion.div
                                initial={{ x: 40, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ duration: 0.5, ease: [0.8, 0, 0.13, 1] }}
                                className="flex flex-col gap-10"
                            >
                                <div className="text-center pt-[6px] pb-4">
                                    <h2 className="text-[24px] font-medium tracking-[0.2em] text-[#00263E]">找回密码</h2>
                                    <div className="mx-auto mt-2 w-[70px] border-b-[1.5px] border-[#00263E]" />
                                </div>
                                <div className="space-y-6">
                                {mobileForgotStep === "phone" && (
                                    <div className="space-y-6">
                                        <div>
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                autoComplete="tel"
                                                required
                                                value={forgotPhone}
                                                onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                                                placeholder="手机号"
                                                className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleMobileSendResetCode}
                                            disabled={loading || forgotPhone.length !== 11}
                                            className="w-full py-3.5 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40"
                                        >
                                            {loading ? "发送中..." : "找回密码"}
                                        </button>
                                    </div>
                                )}

                                {mobileForgotStep === "code" && (
                                    <div className="space-y-6">
                                        <p className="text-center text-sm text-brand-charcoal/60">
                                            验证码已发送至 {forgotPhone.slice(0, 3)}****{forgotPhone.slice(-4)}
                                        </p>
                                        <div className="relative flex gap-2">
                                            <input
                                                type="text"
                                                required
                                                maxLength={6}
                                                value={resetCode}
                                                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                placeholder="6位验证码"
                                                className="flex-1 bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setMobileForgotStep("phone")}
                                                className="flex-1 py-3 text-xs font-medium tracking-[0.2em] text-brand-charcoal/60 border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all"
                                            >
                                                上一步
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!/^\d{6}$/.test(resetCode)) {
                                                        toast.error("请输入 6 位短信验证码。");
                                                        return;
                                                    }
                                                    setMobileForgotStep("password");
                                                }}
                                                disabled={resetCode.length !== 6}
                                                className="flex-1 py-3 text-xs font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40"
                                            >
                                                下一步
                                            </button>
                                        </div>
                                        <p className="text-center text-xs text-brand-charcoal/50 font-medium">
                                            {resetCountdown > 0 ? (
                                                `${resetCountdown}秒后可重新发送`
                                            ) : (
                                                <button type="button" onClick={handleMobileSendResetCode} className="text-brand-gold hover:underline">
                                                    重新发送验证码
                                                </button>
                                            )}
                                        </p>
                                    </div>
                                )}

                                {mobileForgotStep === "password" && (
                                    <form onSubmit={handleMobileResetPassword} className="space-y-6">
                                        <div>
                                            <input
                                                type="password"
                                                required
                                                minLength={PASSWORD_MIN_LENGTH}
                                                value={resetNewPassword}
                                                onChange={(e) => setResetNewPassword(e.target.value)}
                                                placeholder="新密码（8位且含大写/小写/数字）"
                                                maxLength={32}
                                                className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="password"
                                                required
                                                minLength={PASSWORD_MIN_LENGTH}
                                                value={resetConfirmPassword}
                                                onChange={(e) => setResetConfirmPassword(e.target.value)}
                                                placeholder="确认新密码"
                                                maxLength={32}
                                                className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={loading || !validatePasswordStrength(resetNewPassword).valid}
                                            className="w-full py-3.5 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40"
                                        >
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                {loading ? (
                                                    <div className="h-5 w-5 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
                                                ) : "确认重置"}
                                            </span>
                                        </button>
                                    </form>
                                )}

                                {mobileForgotStep === "success" && (
                                    <div className="space-y-6 text-center">
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                                            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                        </div>
                                        <p className="text-xs tracking-widest text-brand-charcoal/40 uppercase">
                                            Password Reset Successful
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setAuthView("login")}
                                            className="w-full py-3.5 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all"
                                        >
                                            返回登录
                                        </button>
                                    </div>
                                )}
                                </div>
                                {mobileForgotStep !== "success" && (
                                    <div className="flex flex-col gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setAuthView("login")}
                                            className="inline-flex h-7 min-h-0 items-center justify-center text-xs text-brand-charcoal/40 tracking-wide hover:text-brand-charcoal/70 transition-colors"
                                        >
                                            返回登录
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ====== WECHAT BIND ====== */}
                        {view === "wechat_bind" && (
                            <div className="flex flex-col gap-10">
                                <div className="text-center pt-[6px] pb-4">
                                    <h2 className="text-[24px] font-medium tracking-[0.2em] text-[#00263E]">绑定手机号</h2>
                                    <div className="mx-auto mt-2 w-[70px] border-b-[1.5px] border-[#00263E]" />
                                </div>
                            <form onSubmit={handleWechatBind} className="w-full space-y-6">
                                <p className="text-center text-sm text-brand-charcoal/60 tracking-wide">
                                    微信授权成功，请绑定手机号以完成登录。
                                </p>
                                <div>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        autoComplete="tel"
                                        required
                                        value={regPhone}
                                        onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                                        placeholder="手机号"
                                        className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                    />
                                </div>
                                <div className="relative flex gap-2">
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        value={regCode}
                                        onChange={(e) => setRegCode(e.target.value)}
                                        placeholder="验证码"
                                        className="flex-1 bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSendRegCode}
                                        disabled={regCodeSending || regCountdown > 0 || !regPhone}
                                        className="shrink-0 self-end mb-2 px-3 py-1 text-xs font-medium tracking-wider text-brand-charcoal/60 border border-brand-charcoal/25 disabled:opacity-30 transition-all"
                                    >
                                        {regCountdown > 0 ? `${regCountdown}s` : "获取"}
                                    </button>
                                </div>
                                <div>
                                    <input
                                        type="password"
                                        required
                                        minLength={PASSWORD_MIN_LENGTH}
                                        value={regPassword}
                                        onChange={(e) => setRegPassword(e.target.value)}
                                        placeholder="密码（8位且含大写/小写/数字）"
                                        maxLength={32}
                                        className="w-full bg-transparent border-0 border-b border-brand-charcoal/25 rounded-none py-3 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider focus:outline-none focus:border-brand-gold/60 transition-colors"
                                    />
                                </div>
                                <label className="flex cursor-pointer items-center gap-2.5 pt-2 group/agreement">
                                    <div className="relative flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={mobileAgreed}
                                            onChange={(e) => setMobileAgreed(e.target.checked)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-4 w-4 rounded border border-brand-charcoal/25 bg-transparent transition-all peer-checked:bg-brand-gold peer-checked:border-brand-gold" />
                                        <Check className="absolute inset-0 m-auto h-3 w-3 scale-0 text-white transition-transform peer-checked:scale-100" strokeWidth={3} />
                                    </div>
                                    <span className="text-xs text-brand-charcoal/50 tracking-wide">
                                        我已阅读并同意
                                        <a href="https://nihplod.cn/terms" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《用户协议》</a>
                                        和
                                        <a href="https://nihplod.cn/privacy" target="_blank" rel="noopener noreferrer" className="underline decoration-brand-charcoal/20 underline-offset-2 hover:text-brand-charcoal transition-colors">《隐私政策》</a>
                                    </span>
                                </label>
                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading || !mobileAgreed}
                                        className="w-full py-3.5 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40"
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            {loading ? (
                                                <div className="h-5 w-5 border-2 border-brand-charcoal/20 border-t-brand-charcoal rounded-full animate-spin" />
                                            ) : (
                                                <>绑定手机号 <CheckCircle size={16} /></>
                                            )}
                                        </span>
                                    </button>
                                </div>
                            </form>
                            </div>
                        )}
                        </div>
                    </div>

                    {/* 手机端页脚 */}
                    <div className="flex-shrink-0 pt-4 pb-4 text-center mx-6">
                        <p className="text-[10px] font-medium tracking-[0.12em] text-[rgba(123,114,108,0.3)] uppercase">
                            &copy; {new Date().getFullYear()} NIHPLOD. All Rights Reserved.
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
