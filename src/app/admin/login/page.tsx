"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, ArrowRight, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/admin/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                router.push("/admin/products");
            } else {
                const data = await res.json();
                setError(data.error || "Login failed");
            }
        } catch (err) {
            setError("An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-t from-slate-100 to-transparent rounded-full blur-3xl opacity-50"></div>
            </div>

            <div className="w-full max-w-sm z-10 animate-in fade-in zoom-in-95 duration-500">
                {/* Brand Header */}
                <div className="flex items-center justify-center gap-4 mb-10">
                    <img 
                        src="/NIHPLOD-logo.svg" 
                        alt="NIHPLOD Logo" 
                        className="w-auto h-6"
                    />
                    <div className="w-px h-5 bg-slate-300"></div>
                    <h2 className="text-xl font-medium text-slate-900 tracking-tight">
                        护肤顾问管理系统
                    </h2>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
                    <form className="space-y-5" onSubmit={handleLogin}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                                    用户名
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="block w-full rounded-lg border-slate-200 bg-slate-50/50 py-2.5 px-4 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all sm:text-sm"
                                    placeholder="请输入您的管理员账号"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                                    密码
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full rounded-lg border-slate-200 bg-slate-50/50 py-2.5 px-4 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all sm:text-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs font-medium text-center border border-red-100 flex items-center justify-center gap-2">
                                <Lock className="w-3 h-3" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative flex w-full justify-center items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    立即登录 <ArrowRight className="w-4 h-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Default Credentials Tip */}
                    <div className="mt-6 pt-6 border-t border-slate-100">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100/50">
                            <div className="mt-0.5 text-blue-500">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-1">
                                    默认管理账号 (开发/测试用)
                                </p>
                                <div className="space-y-0.5">
                                    <p className="text-xs text-blue-600 flex items-center justify-between">
                                        <span className="opacity-70">账号:</span>
                                        <code className="bg-white px-1.5 py-0.5 rounded border border-blue-100 font-mono font-bold">admin</code>
                                    </p>
                                    <p className="text-xs text-blue-600 flex items-center justify-between">
                                        <span className="opacity-70">密码:</span>
                                        <code className="bg-white px-1.5 py-0.5 rounded border border-blue-100 font-mono font-bold">admin123</code>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="mt-8 text-center text-xs text-slate-400 font-medium">
                    &copy; {new Date().getFullYear()} NIHPLOD. All rights reserved.
                </p>
            </div>
        </div>
    );
}
