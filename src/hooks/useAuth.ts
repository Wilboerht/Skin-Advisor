
import { useState, useEffect, createContext, useContext } from 'react';

interface User {
    id: string;
    email: string;
    name?: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (data: any) => Promise<void>;
    register: (data: any) => Promise<void>;
    logout: () => Promise<void>;
}

// Global state using SWR or Context is common. Here's a simple context.
// In a real app, use SWR/TanStack Query for /api/auth/me

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const res = await fetch("/api/auth/me");
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            }
        } catch (e) {
            console.error("Session check failed", e);
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
    };

    const logout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
    };

    return { user, loading, login, register, logout, refresh: checkSession };
}
