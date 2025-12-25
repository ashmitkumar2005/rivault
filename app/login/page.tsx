"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Lock, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
    const [password, setPassword] = useState("");
    const { login } = useAuth();
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        if (!password) {
            setError("Password is required");
            setIsLoading(false);
            return;
        }

        // Fake delay for "security theatre" / nice feel
        await new Promise(r => setTimeout(r, 600));

        const result = await login(password);
        if (!result.success) {
            setError(result.error || "Access Denied.");
            setIsLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decor - already handled by global body, but adding spotlight */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md glass-panel rounded-2xl p-8 shadow-2xl relative z-10 animate-scale-in">

                <div className="flex flex-col items-center mb-8">
                    <div className="relative w-16 h-16 mb-4 group perspective-500">
                        <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-lg group-hover:bg-blue-500/30 transition-all duration-500" />
                        <div className="relative w-full h-full bg-zinc-900/50 rounded-xl border border-white/10 flex items-center justify-center shadow-inner">
                            <Image src="/logo.svg" alt="Logo" width={40} height={40} className="drop-shadow-lg" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400">
                        Rivault
                    </h1>
                    <p className="text-zinc-500 text-sm mt-2 font-medium">Secure. Private. Infinite.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-400 transition-colors">
                            <Lock size={18} />
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/5 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                            placeholder="Master Password"
                            autoFocus
                        />
                        {error && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 animate-pulse">
                                <AlertCircle size={18} />
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="text-xs text-red-400 text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20 animate-fade-in">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full glass-button bg-gradient-to-r from-blue-600/80 to-indigo-600/80 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-blue-900/20 group disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 size={20} className="animate-spin text-white/70" />
                        ) : (
                            <>
                                <span>Unlock Vault</span>
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-2">
                    <div className="flex items-center space-x-2 text-xs text-zinc-500/80 uppercase tracking-widest font-semibold">
                        <ShieldCheck size={12} className="text-emerald-500" />
                        <span>Zero-Knowledge Encryption</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
