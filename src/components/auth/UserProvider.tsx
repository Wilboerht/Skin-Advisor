"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';

// --- Types ---

export interface User {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    avatar?: string | null;
}

interface LoginCredentials {
    email?: string;
    phone?: string;
    password: string;
}

interface RegisterData {
    email?: string;
    phone?: string;
    password: string;
    name?: string;
    code?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isInitialized: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    loginWithCode: (credentials: { phone: string; code: string }) => Promise<void>;
    register: (userData: RegisterData) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

// --- Constants & Helpers ---

const AUTH_CACHE_KEY = 'auth_user_cache';
const AUTH_CACHE_EXPIRY_KEY = 'auth_user_cache_expiry';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function getCachedUser(): { user: User | null; needsRefresh: boolean } {
    if (typeof window === 'undefined') return { user: null, needsRefresh: false };
    try {
        const expiry = localStorage.getItem(AUTH_CACHE_EXPIRY_KEY);
        if (expiry && Date.now() > parseInt(expiry, 10)) {
            localStorage.removeItem(AUTH_CACHE_KEY);
            localStorage.removeItem(AUTH_CACHE_EXPIRY_KEY);
            return { user: null, needsRefresh: false };
        }
        const cached = localStorage.getItem(AUTH_CACHE_KEY);
        if (!cached) return { user: null, needsRefresh: false };

        const user: User = JSON.parse(cached);
        // 缓存中缺少敏感字段时强制刷新
        if (!('role' in user)) {
            return { user, needsRefresh: true };
        }
        return { user, needsRefresh: false };
    } catch {
        return { user: null, needsRefresh: false };
    }
}

function setCachedUser(user: User | null) {
    if (typeof window === 'undefined') return;
    try {
        if (user) {
            // 不缓存敏感字段（role），缩短缓存时间
            const cacheable = {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
            };
            localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cacheable));
            localStorage.setItem(AUTH_CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION_MS));
        } else {
            localStorage.removeItem(AUTH_CACHE_KEY);
            localStorage.removeItem(AUTH_CACHE_EXPIRY_KEY);
        }
    } catch {
        // Ignore storage errors
    }
}

// --- Context ---

const UserContext = createContext<AuthContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    const checkSession = useCallback(async () => {
        try {
            const res = await fetch("/api/auth/me");
            if (!isMountedRef.current) return;
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                setCachedUser(data.user);
            } else {
                setUser(null);
                setCachedUser(null);
            }
        } catch (e) {
            console.error("Session check failed", e);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
                setIsInitialized(true);
            }
        }
    }, []);

    // Initial Load
    useEffect(() => {
        const { user: cachedUser, needsRefresh } = getCachedUser();
        if (cachedUser) {
            setUser(cachedUser);
            if (!needsRefresh) {
                setLoading(false);
            }
        }
        checkSession();
    }, [checkSession]);

    const login = useCallback(async (credentials: LoginCredentials) => {
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(credentials),
                credentials: "include" // 确保Cookie被发送和接收
            });
            const data = await res.json();
            
            if (!res.ok) {
                console.error("🔴 Login API returned error:", data.error);
                throw new Error(data.error || "Login failed");
            }

            setUser(data.user);
            setCachedUser(data.user);

            // 立即刷新 session 以确保 Cookie 已正确设置
            await checkSession();
        } catch (err: unknown) {
            console.error("🔴 Login failed:", err);
            throw err;
        }
    }, [checkSession]);

    const loginWithCode = useCallback(async (credentials: { phone: string; code: string }) => {
        try {
            const res = await fetch("/api/auth/login-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(credentials),
                credentials: "include"
            });
            const data = await res.json();
            
            if (!res.ok) {
                console.error("🔴 LoginCode API returned error:", data.error);
                throw new Error(data.error || "Login failed");
            }

            setUser(data.user);
            setCachedUser(data.user);

            await checkSession();
        } catch (err: unknown) {
            console.error("🔴 LoginWithCode failed:", err);
            throw err;
        }
    }, [checkSession]);

    const register = useCallback(async (userData: RegisterData) => {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");

        setUser(data.user);
        setCachedUser(data.user);
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch (e) {
            console.error("Logout request failed", e);
        } finally {
            // 无论网络请求是否成功，都清除本地状态，确保用户感知到已登出
            setUser(null);
            setCachedUser(null);
        }
    }, []);

    const value = {
        user,
        loading,
        isInitialized,
        login,
        loginWithCode,
        register,
        logout,
        refresh: checkSession
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
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
