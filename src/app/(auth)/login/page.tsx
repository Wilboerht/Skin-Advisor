
"use client";

import { useState } from "react";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { m } from "framer-motion";

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();

    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await login({ phone, password });
            router.push("/"); // Redirect to home or previous page
        } catch (err) {
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
                        Skin Advisor Login
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">
                            手机号
                        </label>
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
                        <label htmlFor="password" className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">
                            密码
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A86C]/20 focus:border-[#C9A86C] transition-all pr-12"
                                placeholder="••••••••"
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

                    <div className="flex justify-end mt-2">
                        <Link
                            href="/forgot-password"
                            className="text-xs text-[#8C8C8C] hover:text-[#1A1A1A] transition-colors"
                        >
                            忘记密码？
                        </Link>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#1A1A1A] text-white rounded-xl py-3.5 font-medium tracking-wide hover:bg-[#2C2C2C] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-[#1A1A1A]/10"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    登录
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-[#8C8C8C] text-sm">
                        还没有账号？{" "}
                        <Link
                            href="/register"
                            className="text-[#C9A86C] font-medium hover:underline hover:text-[#B08D55] transition-colors"
                        >
                            立即注册
                        </Link>
                    </p>
                </div>
            </m.div>
        </div>
    );
}
