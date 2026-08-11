"use client";

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { SsoProvider, useSso } from "@nihplod/sso-sdk/react";
import type { SsoUser } from "@nihplod/sso-sdk";
import { UserRole } from "@/lib/permissions";

// --- Types ---

export interface User {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    avatar?: string | null;
}

// --- Types ---

export interface User {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    avatar?: string | null;
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

// --- Constants ---

const SSO_CLIENT_ID = process.env.NEXT_PUBLIC_SSO_CLIENT_ID!;
const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_BASE_URL!;
const SSO_REDIRECT_URI = process.env.NEXT_PUBLIC_SSO_REDIRECT_URI!;
const SSO_SCOPES = process.env.NEXT_PUBLIC_SSO_SCOPES || "openid profile phone";

function mapSsoUserToLegacyUser(ssoUser: SsoUser | null): User | null {
    if (!ssoUser) return null;
    return {
        id: ssoUser.sub,
        phone: ssoUser.phone || null,
        name: ssoUser.nickname,
        avatar: ssoUser.avatar || null,
        role: UserRole.USER,
    };
}

// --- Context ---

const UserContext = createContext<AuthContextType | undefined>(undefined);

function UserProviderInner({ children }: { children: ReactNode }) {
    const { user: ssoUser, isLoading, login: ssoLogin, logout: ssoLogout, refreshUser } = useSso();

    const user = useMemo(() => mapSsoUserToLegacyUser(ssoUser), [ssoUser]);

    // Preserve legacy async signatures while delegating to SSO (credentials ignored)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const login = async (_credentials?: { email?: string; phone?: string; password?: string }) => {
        await ssoLogin();
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const loginWithCode = async (_credentials: { phone: string; code: string }) => {
        await ssoLogin();
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const register = async (_userData?: { email?: string; phone?: string; password?: string; name?: string; code?: string }) => {
        await ssoLogin();
    };

    const logout = async () => {
        await ssoLogout(false);
    };

    const refresh = async () => {
        await refreshUser();
    };

    const value: AuthContextType = {
        user,
        loading: isLoading,
        isInitialized: !isLoading,
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

export function UserProvider({ children }: { children: ReactNode }) {
    if (!SSO_CLIENT_ID || !SSO_BASE_URL || !SSO_REDIRECT_URI) {
        console.error(
            "[UserProvider] Missing SSO environment variables. " +
            "Please set NEXT_PUBLIC_SSO_CLIENT_ID, NEXT_PUBLIC_SSO_BASE_URL and NEXT_PUBLIC_SSO_REDIRECT_URI."
        );
    }

    return (
        <SsoProvider
            config={{
                clientId: SSO_CLIENT_ID,
                ssoBaseUrl: SSO_BASE_URL,
                redirectUri: SSO_REDIRECT_URI,
                scopes: SSO_SCOPES,
                // Public Client: no clientSecret
            }}
        >
            <UserProviderInner>
                {children}
            </UserProviderInner>
        </SsoProvider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
