
import { useState, useEffect } from 'react';
import { syncWishlistToServer } from '@/lib/wishlist';

interface User {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    vipExpiresAt?: string | null;
}

const AUTH_CACHE_KEY = 'auth_user_cache';
const AUTH_CACHE_EXPIRY_KEY = 'auth_user_cache_expiry';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * 检查缓存中的 VIP 用户是否已过期
 * 如果 role='vip' 且 vipExpiresAt 已过去，返回 true（需要刷新）
 */
function isCachedVipExpired(user: User): boolean {
    if (user.role !== 'vip') return false;
    if (!user.vipExpiresAt) return false; // 无过期时间 = 永久 VIP
    return new Date(user.vipExpiresAt).getTime() <= Date.now();
}

// Get cached user from localStorage
function getCachedUser(): { user: User | null; needsRefresh: boolean } {
    if (typeof window === 'undefined') return { user: null, needsRefresh: false };
    try {
        const expiry = localStorage.getItem(AUTH_CACHE_EXPIRY_KEY);
        if (expiry && Date.now() > parseInt(expiry, 10)) {
            // Cache expired
            localStorage.removeItem(AUTH_CACHE_KEY);
            localStorage.removeItem(AUTH_CACHE_EXPIRY_KEY);
            return { user: null, needsRefresh: false };
        }
        const cached = localStorage.getItem(AUTH_CACHE_KEY);
        if (!cached) return { user: null, needsRefresh: false };

        const user: User = JSON.parse(cached);

        // 检查：如果缓存的 VIP 用户已过期，仍然返回用户数据（避免闪烁）
        // 但标记需要立即向服务端确认
        if (isCachedVipExpired(user)) {
            return { user, needsRefresh: true };
        }

        return { user, needsRefresh: false };
    } catch {
        return { user: null, needsRefresh: false };
    }
}

// Set user cache (VIP 用户的缓存有效期 = min(24h, VIP到期时间))
function setCachedUser(user: User | null) {
    if (typeof window === 'undefined') return;
    try {
        if (user) {
            localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));

            // VIP 用户：缓存有效期不超过 VIP 到期时间
            let cacheDuration = CACHE_DURATION_MS;
            if (user.role === 'vip' && user.vipExpiresAt) {
                const vipRemainingMs = new Date(user.vipExpiresAt).getTime() - Date.now();
                if (vipRemainingMs > 0) {
                    // 缓存不超过 VIP 到期时间 (取较短者)
                    cacheDuration = Math.min(cacheDuration, vipRemainingMs);
                } else {
                    // VIP 已过期，缓存立即过期 (下次读取会触发刷新)
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

export function useAuth() {
    // Always start with null to avoid hydration mismatch
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Client-side only: Try to load cached user first for instant display
        const { user: cachedUser, needsRefresh } = getCachedUser();
        if (cachedUser) {
            setUser(cachedUser);
            // 如果 VIP 已过期，保持 loading 状态以阻止 VIP UI 闪烁
            if (!needsRefresh) {
                setLoading(false);
            }
        }
        // Then validate with server
        checkSession();
    }, []);

    const checkSession = async () => {
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
            // Keep cached user on network error
        } finally {
            setLoading(false);
        }
    };

    const login = async (credentials: any) => {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials)
        });
        if (!res.ok) throw new Error("Login failed");
        const data = await res.json();
        setUser(data.user);
        setCachedUser(data.user);

        // Sync wishlist
        if (data.user?.id) {
            syncWishlistToServer({ userId: data.user.id });
        }
    };

    const register = async (userData: any) => {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        if (!res.ok) throw new Error("Registration failed");
        const data = await res.json();
        setUser(data.user);
        setCachedUser(data.user);

        // Sync wishlist on register too (in case they added items before registering)
        if (data.user?.id) {
            syncWishlistToServer({ userId: data.user.id });
        }
    };

    const logout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        setCachedUser(null);
    };

    const isVip = !!(
        user &&
        (
            (user.role === 'vip' && (!user.vipExpiresAt || new Date(user.vipExpiresAt).getTime() > Date.now())) ||
            ['admin', 'super_admin'].includes(user.role)
        )
    );

    return { user, isVip, loading, login, register, logout, refresh: checkSession };
}
