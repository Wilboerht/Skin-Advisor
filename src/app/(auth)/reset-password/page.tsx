"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "next-view-transitions";
import { Loader2, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const toast = useToast();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!token) {
            toast.error("无效的重置链接");
            // router.push("/login"); // Optional: redirect immediately or show error
        }
    }, [token, toast, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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
                body: JSON.stringify({ token, password })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "重置失败");

            setSuccess(true);
            toast.success("密码重置成功");

            // Auto redirect after 3 seconds
            setTimeout(() => {
                router.push("/login");
            }, 3000);

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-red-100 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-medium text-[#1A1A1A] mb-2">链接无效</h2>
                <p className="text-[#8C8C8C] text-sm mb-6">缺少重置令牌，请检查链接是否完整。</p>
                <Link href="/login" className="text-[#C9A86C] font-medium hover:underline">返回登录</Link>
            </div>
        );
    }

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
                <p className="text-[#8C8C8C] text-sm">请输入您的新密码</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">新密码</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-[#8C8C8C] w-5 h-5" />
                        <input
                            type={showPassword ? "text" : "password"}
                            required
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
                    <label className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">确认新密码</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-[#8C8C8C] w-5 h-5" />
                        <input
                            type={showPassword ? "text" : "password"}
                            required
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
