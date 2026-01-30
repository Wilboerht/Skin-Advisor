"use client";

import { useState } from "react";
import { Link } from "next-view-transitions";
import { ArrowLeft, Loader2, Mail, CheckCircle } from "lucide-react";
import { m } from "framer-motion";
import { useToast } from "@/components/ui/Toast";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const toast = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "请求失败");

            setSubmitted(true);
            toast.success("重置邮件已发送");
        } catch (error: any) {
            toast.error(error.message);
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
                <div className="mb-6">
                    <Link href="/login" className="flex items-center text-sm text-[#8C8C8C] hover:text-[#1A1A1A] transition-colors gap-1">
                        <ArrowLeft size={16} /> 返回登录
                    </Link>
                </div>

                <div className="text-center mb-8">
                    <h1 className="font-serif text-2xl text-[#1A1A1A] mb-2">找回密码</h1>
                    <p className="text-[#8C8C8C] text-sm">
                        请输入您的注册邮箱，我们将向您发送重置密码的链接。
                    </p>
                </div>

                {submitted ? (
                    <div className="text-center py-8">
                        <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-lg font-medium text-[#1A1A1A] mb-2">邮件已发送</h3>
                        <p className="text-[#8C8C8C] text-sm mb-6">
                            我们已向 <strong>{email}</strong> 发送了重置链接。<br />
                            请查收邮件（开发环境请查看控制台）。
                        </p>
                        <button
                            onClick={() => setSubmitted(false)}
                            className="text-[#C9A86C] text-sm font-medium hover:underline"
                        >
                            未收到？重新发送
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-[#4A4A4A] mb-1.5 ml-1">
                                邮箱地址
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-3.5 text-[#8C8C8C] w-5 h-5" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C9A86C]/20 focus:border-[#C9A86C] transition-all"
                                    placeholder="name@example.com"
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
                                "发送重置链接"
                            )}
                        </button>
                    </form>
                )}
            </m.div>
        </div>
    );
}
