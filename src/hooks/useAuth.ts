
import { useState, useEffect } from 'react';
import { syncWishlistToServer } from '@/lib/wishlist';

interface User {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
}

const AUTH_CACHE_KEY = 'auth_user_cache';
const AUTH_CACHE_EXPIRY_KEY = 'auth_user_cache_expiry';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Get cached user from localStorage
function getCachedUser(): User | null {
    if (typeof window === 'undefined') return null;
    try {
        const expiry = localStorage.getItem(AUTH_CACHE_EXPIRY_KEY);
        if (expiry && Date.now() > parseInt(expiry, 10)) {
            // Cache expired
            localStorage.removeItem(AUTH_CACHE_KEY);
            localStorage.removeItem(AUTH_CACHE_EXPIRY_KEY);
            return null;
        }
        const cached = localStorage.getItem(AUTH_CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
    } catch {
        return null;
    }
}

// Set user cache
function setCachedUser(user: User | null) {
    if (typeof window === 'undefined') return;
    try {
        if (user) {
            localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
            localStorage.setItem(AUTH_CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION_MS));
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
        const cachedUser = getCachedUser();
        if (cachedUser) {
            setUser(cachedUser);
            setLoading(false);
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

    return { user, loading, login, register, logout, refresh: checkSession };
}
