"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { syncWishlistToServer } from '@/lib/wishlist';

// --- Types ---

export interface User {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    vipExpiresAt?: string | null;
}

interface AuthContextType {
    user: User | null;
    isVip: boolean;
    loading: boolean;
    isInitialized: boolean;
    login: (credentials: any) => Promise<void>;
    register: (userData: any) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

// --- Constants & Helpers ---

const AUTH_CACHE_KEY = 'auth_user_cache';
const AUTH_CACHE_EXPIRY_KEY = 'auth_user_cache_expiry';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function isCachedVipExpired(user: User): boolean {
    if (user.role !== 'vip') return false;
    if (!user.vipExpiresAt) return false;
    return new Date(user.vipExpiresAt).getTime() <= Date.now();
}

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
        if (isCachedVipExpired(user)) {
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
            localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
            let cacheDuration = CACHE_DURATION_MS;
            if (user.role === 'vip' && user.vipExpiresAt) {
                const vipRemainingMs = new Date(user.vipExpiresAt).getTime() - Date.now();
                if (vipRemainingMs > 0) {
                    cacheDuration = Math.min(cacheDuration, vipRemainingMs);
                } else {
                    cacheDuration = 0;
                }
            }
            localStorage.setItem(AUTH_CACHE_EXPIRY_KEY, String(Date.now() + cacheDuration));
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
    }, []);

    const checkSession = useCallback(async () => {
        try {
            const res = await fetch("/api/auth/me");
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
            setLoading(false);
            setIsInitialized(true);
        }
    }, []);

    const login = useCallback(async (credentials: any) => {
        try {
            console.log("🔐 Sending login request to /api/auth/login...");
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

            console.log("✅ Login successful, received user:", data.user?.id);
            setUser(data.user);
            setCachedUser(data.user);

            // 立即刷新 session 以确保 Cookie 已正确设置
            console.log("🔄 Refreshing session to verify cookie...");
            await checkSession();

            if (data.user?.id) {
                syncWishlistToServer({ userId: data.user.id });
            }
        } catch (err: any) {
            console.error("🔴 Login failed:", err);
            throw err;
        }
    }, [checkSession]);

    const register = useCallback(async (userData: any) => {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");

        setUser(data.user);
        setCachedUser(data.user);

        if (data.user?.id) {
            syncWishlistToServer({ userId: data.user.id });
        }
    }, []);

    const logout = useCallback(async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        setCachedUser(null);
    }, []);

    const isVip = !!(
        user &&
        (
            (user.role === 'vip' && (!user.vipExpiresAt || new Date(user.vipExpiresAt).getTime() > Date.now())) ||
            ['admin', 'super_admin'].includes(user.role)
        )
    );

    const value = {
        user,
        isVip,
        loading,
        isInitialized,
        login,
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
