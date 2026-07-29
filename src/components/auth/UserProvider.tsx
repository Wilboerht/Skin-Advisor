"use client";

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { SsoProvider, useSso } from "@nihplod/sso-sdk/react";
import type { SsoUser } from "@nihplod/sso-sdk";

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
    password?: string;
    name?: string;
    code?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isInitialized: boolean;
    login: (credentials?: LoginCredentials) => Promise<void>;
    loginWithCode: (credentials: { phone: string; code: string }) => Promise<void>;
    register: (userData?: RegisterData) => Promise<void>;
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
        role: "user",
    };
}

// --- Context ---

const UserContext = createContext<AuthContextType | undefined>(undefined);

function UserProviderInner({ children }: { children: ReactNode }) {
    const { user: ssoUser, isLoading, isAuthenticated, login: ssoLogin, logout: ssoLogout, refreshUser } = useSso();

    const user = useMemo(() => mapSsoUserToLegacyUser(ssoUser), [ssoUser]);

    // Preserve legacy async signatures while delegating to SSO
    const login = async (_credentials?: LoginCredentials) => {
        await ssoLogin();
    };

    const loginWithCode = async (_credentials: { phone: string; code: string }) => {
        // SSO provider handles SMS code login on the central login page
        await ssoLogin();
    };

    const register = async (_userData?: RegisterData) => {
        // SSO provider handles registration on the central login page
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
