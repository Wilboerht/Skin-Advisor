"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

// --- Types ---

export interface User {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    avatar?: string | null;
    /** SSO 会员等级（REGULAR 普通/SILVER 银卡/GOLD 金卡/DIAMOND 钻石），null/未知视为普通 */
    membershipLevel?: string | null;
    /** 主站累计消费金额（元），用于 SILVER 银卡测肤加赠 */
    totalSpent?: number | null;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isInitialized: boolean;
    // SSO 迁移后所有 credential 参数不再使用（由 nihplod.cn 集中处理），
    // 保留参数签名以维持向后兼容，实际调用均忽略参数
    login: (credentials?: { email?: string; phone?: string; password?: string }) => Promise<void>;
    loginWithCode: (credentials: { phone: string; code: string }) => Promise<void>;
    register: (userData?: { email?: string; phone?: string; password?: string; name?: string; code?: string }) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

// --- Context ---

const UserContext = createContext<AuthContextType | undefined>(undefined);

/**
 * BFF 模式的用户会话 Provider。
 *
 * SSO token 全部存于 httpOnly Cookie（浏览器 JS 不可读），前端登录态以
 * 服务端 /api/auth/me 为准：挂载时拉取一次；access_token 过期由该端点
 * 用 refresh_token 静默轮换。
 *
 * 登录/登出均为整页跳转的服务端流程：
 * - login  → /api/auth/login（服务端种 PKCE Cookie 后 302 到主站 authorize）
 * - logout → POST /api/auth/logout（清 SSO + 本地会话 Cookie）后回首页
 */
export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    // 单飞：并发 loadUser（挂载 + 定时器 + visibilitychange）共享同一次请求，
    // 避免 /api/auth/me 的 refresh_token 轮换被并发调用打爆
    const inflightRef = useRef<Promise<void> | null>(null);

    const loadUser = useCallback(async () => {
        if (inflightRef.current) return inflightRef.current;

        inflightRef.current = (async () => {
        // 10s 超时兜底；超时不视为未登录，保留现有会话状态（避免弱网误踢）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
            const res = await fetch("/api/auth/me", { cache: "no-store", signal: controller.signal });
            if (!res.ok) {
                // 429 限流 / 5xx 等临时故障不代表已登出，保留现有登录状态，
                // 交给下一次定时续期或操作时再确认
                return;
            }
            const data = (await res.json()) as { user: User | null };
            setUser(data.user ?? null);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                // 请求超时：保持现有登录状态不变
                return;
            }
            // 网络异常（断网/DNS/主站不可达）同样保留现有状态，避免误踢
            return;
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
        })();

        try {
            await inflightRef.current;
        } finally {
            inflightRef.current = null;
        }
    }, []);

    useEffect(() => {
        loadUser();

        // 定时续期：SSO access token 仅 15 分钟，期间若不触发 /api/auth/me
        // 轮换，测肤等长流程中的 API 调用会被误判为未登录。
        // 每 10 分钟（且在页面可见时）静默刷新一次，保持会话活跃。
        const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") {
                loadUser();
            }
        }, REFRESH_INTERVAL_MS);

        // 从后台切回 / 网络恢复时立即刷新一次，第一时间修复过期会话
        const handleVisible = () => {
            if (document.visibilityState === "visible") {
                loadUser();
            }
        };
        document.addEventListener("visibilitychange", handleVisible);
        window.addEventListener("online", handleVisible);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisible);
            window.removeEventListener("online", handleVisible);
        };
    }, [loadUser]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const login = useCallback(async (_credentials?: { email?: string; phone?: string; password?: string }) => {
        // 登录/注册页自身不作为回跳目标，避免登录成功后回到 /login 再次触发跳转
        const { pathname, search } = window.location;
        const returnTo = pathname === "/login" || pathname === "/register" ? "/" : pathname + search;
        window.location.href = `/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const loginWithCode = useCallback(async (_credentials: { phone: string; code: string }) => login(), [login]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const register = useCallback(async (_userData?: { email?: string; phone?: string; password?: string; name?: string; code?: string }) => login(), [login]);

    const logout = useCallback(async () => {
        try {
            // POST-only + 同源校验；服务端会清除 SSO Cookie、撤销 refresh_token 并清本地会话
            await fetch("/api/auth/logout", { method: "POST" });
        } catch {
            // 网络异常也继续本地清理并回首页
        }
        setUser(null);
        window.location.href = "/";
    }, []);

    const refresh = useCallback(async () => {
        await loadUser();
    }, [loadUser]);

    const value: AuthContextType = {
        user,
        loading,
        isInitialized: !loading,
        login,
        loginWithCode,
        register,
        logout,
        refresh,
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within UserProvider');
    }
    return context;
}
