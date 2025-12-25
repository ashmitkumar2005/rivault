"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
    isAuthenticated: boolean;
    masterPassword: string | null;
    login: (password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [masterPassword, setMasterPassword] = useState<string | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    const isAuthenticated = !!masterPassword;

    const login = async (password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_URL}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (!res.ok) {
                return { success: false, error: "Invalid Password" };
            }

            setMasterPassword(password);
            localStorage.setItem("rivault_key", password); // Persist
            router.push("/explorer");
            return { success: true };
        } catch (err) {
            console.error("Login verification failed", err);
            return { success: false, error: "Connection refused. Is backend running?" };
        }
    };

    const logout = () => {
        setMasterPassword(null);
        localStorage.removeItem("rivault_key"); // Clear persistence
        router.push("/login");
    };

    useEffect(() => {
        // Load from storage on mount
        const stored = localStorage.getItem("rivault_key");
        if (stored) {
            setMasterPassword(stored);
        }
    }, []);

    useEffect(() => {
        // Determine strict protected routes
        // Wait for initial load check to avoid premature redirect? 
        // Boolean conversion of masterPassword is safe, but we might want a 'loading' state.
        // For now, if no masterPassword and no stored key (handled by separate effect order), redirect.
        // Actually, the storage check runs once. If we reload, masterPassword is null initially.
        // We should prevent redirect until we check storage.

        // Simplified: If authenticated, we are good. If not, and we are on protected route...
        // We need to wait for the mount effect. 
        // But `useEffect`s run in order.

        const stored = localStorage.getItem("rivault_key");
        if (!masterPassword && !stored && pathname !== "/login" && pathname !== "/error") {
            router.push("/login");
        }
    }, [masterPassword, pathname, router]);

    return (
        <AuthContext.Provider value={{ isAuthenticated, masterPassword, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
