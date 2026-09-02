"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// --- Types ---

export interface User {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    avatar?: string | null;
    /** SSO 会员等级（REGULAR/ADVANCED），null 视为普通会员 */
    membershipLevel?: string | null;
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

    const loadUser = useCallback(async () => {
        // 10s 超时兜底；超时不视为未登录，保留现有会话状态（避免弱网误踢）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
            const res = await fetch("/api/auth/me", { cache: "no-store", signal: controller.signal });
            if (!res.ok) {
                setUser(null);
                return;
            }
            const data = (await res.json()) as { user: User | null };
            setUser(data.user ?? null);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                // 请求超时：保持现有登录状态不变
                return;
            }
            setUser(null);
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUser();
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
