
"use client";

import { useEffect, useState } from "react";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { m } from "framer-motion";

export default function RegisterPage() {
    const router = useRouter();
    const { register } = useAuth();
    const toast = useToast();

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!cooldown) return;
        const timer = setInterval(() => setCooldown((c) => Math.max(c - 1, 0)), 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const sendCode = async () => {
        if (cooldown || !phone) return;
        setSendingCode(true);
        try {
            const res = await fetch("/api/auth/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "验证码发送失败");
            toast.success("验证码已发送");
            setCooldown(60);
        } catch (err: any) {
            toast.error(err.message || "验证码发送失败");
        } finally {
            setSendingCode(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await register({ name, phone, code, password });
            toast.success("注册成功！");
            router.push("/"); // Redirect to home
        } catch (err) {
            toast.error("注册失败，请稍后重试");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F5] p-4">
            <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-[#E6E2D6]"
            >
                <div className="text-center mb-8">
                    <h1 className="font-serif text-3xl text-[#1A1A1A] mb-2 tracking-wide">
                        NIHPLOD
                    </h1>
                    <p className="text-[#8C8C8C] text-sm tracking-wider uppercase">
                        Create Account
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">
                            姓名
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A86C]/20 focus:border-[#C9A86C] transition-all"
                            placeholder="Your Name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">
                            手机号
                        </label>
                        <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A86C]/20 focus:border-[#C9A86C] transition-all"
                            placeholder="请输入手机号"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">
                            验证码
                        </label>
                        <div className="flex gap-3">
                            <input
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
                        <label className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">
                            密码
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A86C]/20 focus:border-[#C9A86C] transition-all pr-12"
                                placeholder="Min. 6 characters"
                                minLength={6}
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

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#C9A86C] text-white rounded-xl py-3.5 font-medium tracking-wide hover:bg-[#B08D55] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-[#C9A86C]/20"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    注册
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-[#8C8C8C] text-sm">
                        已有账号？{" "}
                        <Link
                            href="/login"
                            className="text-[#1A1A1A] font-medium hover:underline transition-colors"
                        >
                            立即登录
                        </Link>
                    </p>
                </div>
            </m.div>
        </div>
    );
}
