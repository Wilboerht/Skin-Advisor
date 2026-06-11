"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Link } from "next-view-transitions";
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

function ResetPasswordForm() {
    const router = useRouter();
    const toast = useToast();

    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (!cooldown) return;
        const timer = setInterval(() => setCooldown((c) => Math.max(c - 1, 0)), 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const sendCode = async () => {
        if (cooldown || !phone) {
            toast.error(!phone ? "请先输入手机号" : "请稍后再试");
            return;
        }
        setSendingCode(true);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "验证码发送失败");
            toast.success("验证码已发送");
            setCooldown(60);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("[ResetPasswordSendCode]", error.message);
            toast.error("验证码发送失败，请稍后重试");
        } finally {
            setSendingCode(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!phone || !code) {
            toast.error("请输入手机号和验证码");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("两次输入的密码不一致");
            return;
        }

        if (password.length < 6) {
            toast.error("密码长度至少为 6 位");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, code, password })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "重置失败");

            setSuccess(true);
            toast.success("密码重置成功");

            // Auto redirect after 3 seconds
            setTimeout(() => {
                router.push("/login");
            }, 3000);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("[ResetPassword]", error.message);
            toast.error("重置失败，请稍后重试");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-[#E6E2D6] text-center">
                <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-medium text-[#1A1A1A] mb-2">密码重置成功</h3>
                <p className="text-[#8C8C8C] text-sm mb-6">
                    您的密码已更新。正在跳转到登录页面...
                </p>
                <Link href="/login" className="bg-[#1A1A1A] text-white rounded-xl px-6 py-2 text-sm font-medium hover:bg-[#2C2C2C] transition-colors">
                    立即登录
                </Link>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-[#E6E2D6]">
            <div className="text-center mb-8">
                <h1 className="font-serif text-2xl text-[#1A1A1A] mb-2">重置密码</h1>
                <p className="text-[#8C8C8C] text-sm">请输入手机号、验证码与新密码</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">手机号</label>
                    <input
                        id="phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        pattern="1[3-9]\d{9}"
                        className="w-full px-4 py-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A86C]/20 focus:border-[#C9A86C] transition-all"
                        placeholder="请输入手机号"
                    />
                </div>

                <div>
                    <label htmlFor="code" className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">验证码</label>
                    <div className="flex gap-3">
                        <input
                            id="code"
                            type="text"
                            required
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A86C]/20 focus:border-[#C9A86C] transition-all"
                            placeholder="短信验证码"
                        />
                        <button
                            type="button"
                            onClick={sendCode}
                            disabled={sendingCode || cooldown > 0 || !phone}
                            className="px-4 whitespace-nowrap rounded-xl border border-[#C9A86C] text-[#C9A86C] font-medium hover:bg-[#C9A86C]/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {sendingCode ? "发送中..." : cooldown ? `${cooldown}s` : "获取验证码"}
                        </button>
                    </div>
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">新密码</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-[#8C8C8C] w-5 h-5" />
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-11 pr-12 py-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A86C]/20 focus:border-[#C9A86C] transition-all"
                            placeholder="至少 6 位字符"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8C8C8C] hover:text-[#1A1A1A]"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">确认新密码</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-[#8C8C8C] w-5 h-5" />
                        <input
                            id="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A86C]/20 focus:border-[#C9A86C] transition-all"
                            placeholder="再次输入密码"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#1A1A1A] text-white rounded-xl py-3.5 font-medium tracking-wide hover:bg-[#2C2C2C] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-[#1A1A1A]/10"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        "重置密码"
                    )}
                </button>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F5] p-4">
            <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-[#C9A86C]" />}>
                <ResetPasswordForm />
            </Suspense>
        </div>
    );
}
