"use client";

import React, { createContext, useContext, useState } from "react";

export type AuthView = "login" | "register" | "forgot_password" | "wechat_bind";

interface AuthModalContextType {
    isOpen: boolean;
    view: AuthView;
    openAuthModal: (view?: AuthView) => void;
    closeAuthModal: () => void;
    setAuthView: (view: AuthView) => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<AuthView>("login");

    const openAuthModal = (initialView: AuthView = "login") => {
        setView(initialView);
        setIsOpen(true);
    };

    const closeAuthModal = () => {
        setIsOpen(false);
        setView("login");
    };

    return (
        <AuthModalContext.Provider value={{ isOpen, view, openAuthModal, closeAuthModal, setAuthView: setView }}>
            {children}
        </AuthModalContext.Provider>
    );
}

export function useAuthModal() {
    const context = useContext(AuthModalContext);
    if (!context) throw new Error("useAuthModal must be used within AuthModalProvider");
    return context;
}
