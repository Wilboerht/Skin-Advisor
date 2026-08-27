"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthModal } from "./AuthModalContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, CheckCircle, Check, ChevronLeft } from "lucide-react";
import { validatePasswordStrength, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

// SSO 迁移后，login / register / forgot_password 统一引导至主站账号中心，
// 仅 wechat_bind 仍在弹窗内完成。
const SSO_VIEW_TITLES: Record<string, string> = {
    login: "登录",
    register: "注册会员",
    forgot_password: "找回密码",
};

export function AuthModal() {
    const { isOpen, view, openAuthModal, closeAuthModal } = useAuthModal();
    const { login } = useAuth();
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

    // WeChat Bind Fields
    const [regPhone, setRegPhone] = useState("");
    const [regCode, setRegCode] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regCodeSending, setRegCodeSending] = useState(false);
    const [regCountdown, setRegCountdown] = useState(0);

    const [showPassword, setShowPassword] = useState(false);
    const [mobileAgreed, setMobileAgreed] = useState(false);
    const [agreementShake, setAgreementShake] = useState(0);

    // Reset states when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            setRegPhone("");
            setRegCode("");
            setRegPassword("");
            setRegCodeSending(false);
            setRegCountdown(0);
            setShowPassword(false);
            setMobileAgreed(false);
            setAgreementShake(0);
        }
    }, [isOpen]);

    // Reset shared fields when entering WeChat Bind
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

    // 禁止背景滚动（移动端使用 fixed 定位防止 iOS 弹性滚动）
    useBodyScrollLock({ enabled: isOpen, iosSafe: true });

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

    // ===== PC 端输入框通用样式 =====
    const pcInputClass = "w-full bg-transparent border-0 border-b border-brand-charcoal/20 rounded-none py-4 px-0 text-base tracking-wide text-brand-charcoal placeholder:text-brand-charcoal/40 placeholder:text-sm placeholder:tracking-wider placeholder:uppercase focus:outline-none focus:border-brand-charcoal/40 transition-colors";
    const pcBtnClass = "w-full py-4 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2";

    const isSsoView = view === "login" || view === "register" || view === "forgot_password";

    // login / register / forgot_password：SSO 迁移后统一引导至主站账号中心
    const ssoPanel = (
        <>
            <h1 className="text-center text-[2rem] font-light tracking-[0.15em] text-brand-charcoal mb-8">
                {SSO_VIEW_TITLES[view] ?? "登录"}
            </h1>
            <p className="text-center text-sm leading-relaxed text-brand-charcoal/60 tracking-wide mb-12">
                账号登录、注册与密码管理已统一由 NIHPLOD 账号中心处理。
            </p>
            <button
                type="button"
                onClick={() => login()}
                className={pcBtnClass}
            >
                前往 NIHPLOD 账号中心
            </button>
        </>
    );

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
                    className="fixed inset-0 z-[100002] bg-black/20 backdrop-blur-md"
                />
                <motion.div
                    key={`pc-panel-${view}`}
                    initial={{ x: "100%" }}
                    animate={{ x: 0, transition: { duration: 0.8, ease: [0.8, 0, 0.13, 1] } }}
                    exit={{ x: "100%", transition: { duration: 0.5, ease: [0.8, 0, 0.13, 1] } }}
                    className="hidden md:flex fixed inset-y-0 right-0 w-full bg-white flex-col z-[100003]"
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

                                {/* ====== SSO（login / register / forgot_password） ====== */}
                                {isSsoView && ssoPanel}

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
                    className="md:hidden fixed inset-0 z-[100003] pl-4 pr-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] bg-[#FDFBF7] flex flex-col"
                >
                    {/* 手机端顶部栏 */}
                    <div className="flex-shrink-0 h-[56px] w-full flex items-center justify-center relative">
                        <button
                            type="button"
                            onClick={view === "wechat_bind" ? handleCancelWechatBind : closeAuthModal}
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

                        {/* ====== SSO（login / register / forgot_password） ====== */}
                        {isSsoView && (
                            <div className="flex flex-col gap-10">
                                {view === "login" && (
                                    <div className="flex justify-center">
                                        <img
                                            src="/NIHPLOD-logo.svg"
                                            alt="NIHPLOD Logo"
                                            className="object-contain h-auto w-[140px]"
                                        />
                                    </div>
                                )}
                                <div className="text-center pt-[6px] pb-4">
                                    <h2 className="text-[24px] font-medium tracking-[0.2em] text-[#00263E]">
                                        {SSO_VIEW_TITLES[view] ?? "登录"}
                                    </h2>
                                    <div className="mx-auto mt-2 w-[70px] border-b-[1.5px] border-[#00263E]" />
                                </div>
                                <p className="text-center text-sm leading-relaxed text-brand-charcoal/60 tracking-wide">
                                    账号登录、注册与密码管理已统一由 NIHPLOD 账号中心处理。
                                </p>
                                <button
                                    type="button"
                                    onClick={() => login()}
                                    className="w-full py-3.5 min-h-12 text-sm font-medium tracking-[0.2em] text-brand-charcoal border border-brand-charcoal/25 hover:bg-brand-charcoal/[0.03] active:scale-[0.98] transition-all disabled:opacity-40"
                                >
                                    前往 NIHPLOD 账号中心
                                </button>
                            </div>
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
